/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
	type EscrowDomain,
	getEscrowAccount,
	getPaymentChannel,
	getSandbox,
	listPendingVouchers,
	type PendingVoucher,
	type PendingVouchers,
	submitVoucherSignature,
	VoucherSigningMode,
} from '@snapflow/api-client';
import type { Client } from '@snapflow/api-client/client';
import { voucherTypedData } from '@snapflow/contracts';
import { type Address, getAddress, type LocalAccount } from 'viem';
import {
	SnapflowVoucherRejectedError,
	VoucherRejectionReason,
} from '../errors/settlement-error.js';
import {
	SnapflowError,
	SnapflowNotFoundError,
	SnapflowValidationError,
} from '../errors/snapflow-error.js';
import { abortableDelay } from '../utils/async.js';
import { MILLISECONDS_PER_SECOND } from '../utils/timeout.js';
import { type SessionKeySource, toSessionKeyAccount } from './session-key.js';
import {
	assertValidSpendPolicy,
	type VoucherSpendPolicy,
} from './spend-policy.js';
import {
	type ChannelFacts,
	rejectVoucher,
	type SignedVoucherRecord,
	type TrustedEscrow,
	verifyChannel,
	verifyPendingVoucher,
} from './voucher-verification.js';

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const BACKOFF_MAXIMUM_MINUTES = 5;

/** Snapflow issues vouchers every minute by default; polling at the same pace keeps every lease covered. */
export const DEFAULT_VOUCHER_POLL_INTERVAL_MILLISECONDS =
	SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
const BACKOFF_INITIAL_MILLISECONDS = MILLISECONDS_PER_SECOND;
const BACKOFF_MAXIMUM_MILLISECONDS =
	BACKOFF_MAXIMUM_MINUTES * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
const BACKOFF_FACTOR = 2;
const CHANNEL_RETENTION_HOURS = 24;
/**
 * How long a channel without pending vouchers is remembered. Snapflow
 * reissues an open channel's voucher at the latest halfway through its
 * 24-hour lifetime, so only closed channels stay away this long.
 */
export const CHANNEL_RETENTION_MILLISECONDS =
	CHANNEL_RETENTION_HOURS *
	MINUTES_PER_HOUR *
	SECONDS_PER_MINUTE *
	MILLISECONDS_PER_SECOND;

export interface VoucherSignerOptions {
	/** The session key the funding wallet authorized with `Escrow.authorizeSessionKey`. */
	sessionKey: SessionKeySource;
	/** The organization's funding wallet; every voucher must be paid by it. */
	fundingWallet: Address;
	policy: VoucherSpendPolicy;
	/**
	 * Receives every failure: API errors (after which polling backs off
	 * exponentially), vouchers refused as SnapflowVoucherRejectedError (each
	 * reported once) and signing errors. It must not throw; if it does, the
	 * signer stops and `stop()` rejects with that error.
	 */
	onError: (error: Error) => void;
	pollIntervalMilliseconds?: number;
	/** Stops the signer when aborted, like calling `stop()`. */
	signal?: AbortSignal;
}

/** What the signer remembers about a channel while it keeps showing up in the pending vouchers. */
interface ChannelState {
	/** Set once the channel is verified as a client-signed lease channel. */
	facts?: ChannelFacts;
	/** Snapflow's delegated signer signs this channel. */
	delegated: boolean;
	lastSigned?: SignedVoucherRecord;
	/** The voucher sequence refused last, reported once. */
	rejectedSequence?: number;
	/** When the channel last had a pending voucher (epoch milliseconds). */
	pendingAt: number;
}

function channelKey(channelId: string): string {
	return channelId.toLowerCase();
}

function domainKey(domain: EscrowDomain): string {
	return `${domain.chainId}:${domain.verifyingContract.toLowerCase()}`;
}

function matchesEscrow(escrow: TrustedEscrow, domain: EscrowDomain): boolean {
	return (
		escrow.chainId === domain.chainId &&
		escrow.verifyingContract.toLowerCase() ===
			domain.verifyingContract.toLowerCase()
	);
}

/**
 * Signs the vouchers of sandboxes created with `voucherSigning: 'client'`
 * with a session key the caller holds, after verifying each one locally.
 */
export class VoucherSigner {
	public readonly address: Address;
	private readonly account: LocalAccount;
	private readonly fundingWallet: Address;
	private readonly pollIntervalMilliseconds: number;
	private readonly channels = new Map<string, ChannelState>();
	private trustedEscrow?: TrustedEscrow;
	private trustedEscrowFetchedFor?: string;
	private controller?: AbortController;
	private loop?: Promise<void>;

	constructor(
		private readonly client: Client,
		private readonly options: VoucherSignerOptions
	) {
		assertValidSpendPolicy(options.policy);
		this.pollIntervalMilliseconds =
			options.pollIntervalMilliseconds ??
			DEFAULT_VOUCHER_POLL_INTERVAL_MILLISECONDS;
		if (
			!Number.isFinite(this.pollIntervalMilliseconds) ||
			this.pollIntervalMilliseconds <= 0
		) {
			throw new SnapflowValidationError(
				'pollIntervalMilliseconds must be a positive number'
			);
		}
		this.account = toSessionKeyAccount(options.sessionKey);
		this.address = this.account.address;
		this.fundingWallet = getAddress(options.fundingWallet);
	}

	public get running(): boolean {
		return this.controller !== undefined && !this.controller.signal.aborted;
	}

	/** Starts polling immediately; calling it while running does nothing. */
	public start(): void {
		if (this.running) return;
		this.options.signal?.throwIfAborted();
		const controller = new AbortController();
		const loop = this.run(controller);
		// stop() delivers a rejection; this only keeps it from being reported as
		// unhandled until then.
		loop.catch(() => undefined);
		this.controller = controller;
		this.loop = loop;
	}

	/** Stops polling and waits for an in-flight signature to finish or abort. */
	public async stop(): Promise<void> {
		this.controller?.abort();
		await this.loop;
	}

	private async run(controller: AbortController): Promise<void> {
		const signal = this.options.signal
			? AbortSignal.any([controller.signal, this.options.signal])
			: controller.signal;
		let failures = 0;
		try {
			while (!signal.aborted) {
				failures = (await this.signPending(signal)) ? 0 : failures + 1;
				if (signal.aborted) break;
				await abortableDelay(this.delay(failures), signal).catch(
					(error: unknown) => {
						if (!signal.aborted) throw error;
					}
				);
			}
		} finally {
			controller.abort();
		}
	}

	private delay(failures: number): number {
		return failures === 0
			? this.pollIntervalMilliseconds
			: Math.min(
					BACKOFF_INITIAL_MILLISECONDS * BACKOFF_FACTOR ** (failures - 1),
					BACKOFF_MAXIMUM_MILLISECONDS
				);
	}

	/** Signs every pending voucher once; false when an API call failed. */
	private async signPending(signal: AbortSignal): Promise<boolean> {
		let pending: PendingVouchers;
		let escrow: TrustedEscrow;
		try {
			pending = (await listPendingVouchers({ client: this.client, signal }))
				.data;
			escrow = await this.trustedEscrowFor(pending.domain, signal);
		} catch (error) {
			if (signal.aborted) return true;
			this.report(error);
			return false;
		}
		const now = Date.now();
		let healthy = true;
		for (const entry of pending.vouchers) {
			if (signal.aborted) break;
			const channel = this.channelState(entry, now);
			try {
				await this.signVoucher(pending.domain, escrow, entry, channel, signal);
			} catch (error) {
				if (signal.aborted) break;
				if (error instanceof SnapflowVoucherRejectedError) {
					channel.rejectedSequence = entry.voucher.sequence;
				} else {
					healthy = false;
				}
				this.report(error);
			}
		}
		this.forgetIdleChannels(now);
		return healthy;
	}

	/**
	 * The escrow Snapflow reports for the organization, fetched on the first
	 * poll and fetched again once for each domain that does not match it, in
	 * case the configuration changed; a domain that still differs is refused.
	 */
	private async trustedEscrowFor(
		domain: EscrowDomain,
		signal: AbortSignal
	): Promise<TrustedEscrow> {
		const key = domainKey(domain);
		if (
			this.trustedEscrow &&
			(matchesEscrow(this.trustedEscrow, domain) ||
				this.trustedEscrowFetchedFor === key)
		) {
			return this.trustedEscrow;
		}
		const { data: account } = await getEscrowAccount({
			client: this.client,
			signal,
		});
		this.trustedEscrow = {
			chainId: account.chainId,
			verifyingContract: getAddress(account.escrowAddress),
		};
		this.trustedEscrowFetchedFor = key;
		return this.trustedEscrow;
	}

	private channelState(entry: PendingVoucher, now: number): ChannelState {
		const key = channelKey(entry.channelId);
		const channel = this.channels.get(key) ?? {
			delegated: false,
			pendingAt: now,
		};
		channel.pendingAt = now;
		this.channels.set(key, channel);
		return channel;
	}

	private forgetIdleChannels(now: number): void {
		for (const [key, channel] of this.channels) {
			if (now - channel.pendingAt > CHANNEL_RETENTION_MILLISECONDS) {
				this.channels.delete(key);
			}
		}
	}

	private async signVoucher(
		domain: EscrowDomain,
		escrow: TrustedEscrow,
		entry: PendingVoucher,
		channel: ChannelState,
		signal: AbortSignal
	): Promise<void> {
		if (channel.rejectedSequence === entry.voucher.sequence) return;
		const facts = await this.channelFacts(entry, channel, signal);
		if (!facts) return;
		const now = Date.now();
		const verified = verifyPendingVoucher({
			domain,
			escrow,
			entry,
			channel: facts,
			lastSigned: channel.lastSigned,
			policy: this.options.policy,
			now,
		});
		const signature = await this.account.signTypedData(
			voucherTypedData(verified.domain, verified.voucher)
		);
		await submitVoucherSignature({
			client: this.client,
			body: {
				channelId: entry.channelId,
				sequence: entry.voucher.sequence,
				signer: this.address,
				signature,
			},
			signal,
		});
		channel.lastSigned = { voucher: verified.voucher, signedAt: now };
	}

	/** The verified channel, or undefined when Snapflow's delegated signer signs it. */
	private async channelFacts(
		entry: PendingVoucher,
		channel: ChannelState,
		signal: AbortSignal
	): Promise<ChannelFacts | undefined> {
		if (channel.facts || channel.delegated) return channel.facts;
		const { data: paymentChannel } = await getPaymentChannel({
			client: this.client,
			path: { channelId: entry.channelId },
			signal,
		});
		if (paymentChannel.signingMode !== VoucherSigningMode.Client) {
			channel.delegated = true;
			return undefined;
		}
		const facts = verifyChannel(entry, paymentChannel, this.fundingWallet);
		await this.assertSandboxOwned(entry, facts, signal);
		channel.facts = facts;
		return facts;
	}

	private async assertSandboxOwned(
		entry: PendingVoucher,
		channel: ChannelFacts,
		signal: AbortSignal
	): Promise<void> {
		try {
			const { data: sandbox } = await getSandbox({
				client: this.client,
				path: { sandboxIdOrName: channel.sandboxId },
				signal,
			});
			if (sandbox.id === channel.sandboxId) return;
		} catch (error) {
			if (!(error instanceof SnapflowNotFoundError)) throw error;
		}
		throw rejectVoucher(
			entry,
			VoucherRejectionReason.SandboxNotOwned,
			`sandbox ${channel.sandboxId} is not one of this organization's`
		);
	}

	private report(error: unknown): void {
		this.options.onError(
			error instanceof Error ? error : new SnapflowError(String(error))
		);
	}
}
