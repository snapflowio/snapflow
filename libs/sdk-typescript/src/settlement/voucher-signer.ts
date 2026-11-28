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
	listPendingVouchers,
	type PendingVoucher,
	type PendingVouchers,
	submitVoucherSignature,
	VoucherSigningMode,
} from '@snapflow/api-client';
import type { Client } from '@snapflow/api-client/client';
import { voucherTypedData } from '@snapflow/contracts';
import { type Address, getAddress, type LocalAccount } from 'viem';
import { SnapflowVoucherRejectedError } from '../errors/settlement-error.js';
import {
	SnapflowError,
	SnapflowValidationError,
} from '../errors/snapflow-error.js';
import { abortableDelay } from '../utils/async.js';
import {
	MILLISECONDS_PER_HOUR,
	MILLISECONDS_PER_MINUTE,
	MILLISECONDS_PER_SECOND,
} from '../utils/timeout.js';
import { type SessionKeySource, toSessionKeyAccount } from './session-key.js';
import { fetchSettlementFees, type SettlementFees } from './settlement-fees.js';
import {
	assertValidSpendPolicy,
	type VoucherSpendPolicy,
} from './spend-policy.js';
import {
	type ChannelFacts,
	type SignedVoucherRecord,
	type TrustedEscrow,
	verifyChannel,
	verifyPendingVoucher,
} from './voucher-verification.js';

const BACKOFF_MAXIMUM_MINUTES = 5;

export const DEFAULT_VOUCHER_POLL_INTERVAL_MILLISECONDS =
	MILLISECONDS_PER_MINUTE;
const BACKOFF_INITIAL_MILLISECONDS = MILLISECONDS_PER_SECOND;
const BACKOFF_MAXIMUM_MILLISECONDS =
	BACKOFF_MAXIMUM_MINUTES * MILLISECONDS_PER_MINUTE;
const BACKOFF_FACTOR = 2;
const CHANNEL_RETENTION_HOURS = 24;
export const CHANNEL_RETENTION_MILLISECONDS =
	CHANNEL_RETENTION_HOURS * MILLISECONDS_PER_HOUR;

export interface VoucherSignerOptions {
	sessionKey: SessionKeySource;
	fundingWallet: Address;
	policy: VoucherSpendPolicy;
	onError: (error: Error) => void;
	pollIntervalMilliseconds?: number;
	signal?: AbortSignal;
}

interface ChannelState {
	facts?: ChannelFacts;
	delegated: boolean;
	lastSigned?: SignedVoucherRecord;
	rejectedSequence?: number;
	pendingAt: number;
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

	public start(): void {
		if (this.running) return;
		this.options.signal?.throwIfAborted();
		const controller = new AbortController();
		const loop = this.run(controller);
		loop.catch(() => undefined);
		this.controller = controller;
		this.loop = loop;
	}

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

	private async signPending(signal: AbortSignal): Promise<boolean> {
		let pending: PendingVouchers;
		let escrow: TrustedEscrow;
		let fees: SettlementFees;
		try {
			pending = (await listPendingVouchers({ client: this.client, signal }))
				.data;
			[escrow, fees] = await Promise.all([
				this.trustedEscrowFor(pending.domain, signal),
				fetchSettlementFees(this.client, signal),
			]);
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
				await this.signVoucher(
					pending.domain,
					escrow,
					fees,
					entry,
					channel,
					signal
				);
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
		const channel = this.channels.get(entry.paymentChannelId) ?? {
			delegated: false,
			pendingAt: now,
		};
		channel.pendingAt = now;
		this.channels.set(entry.paymentChannelId, channel);
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
		fees: SettlementFees,
		entry: PendingVoucher,
		channel: ChannelState,
		signal: AbortSignal
	): Promise<void> {
		if (channel.rejectedSequence === entry.voucher.sequence) return;
		const facts = await this.channelFacts(entry, escrow, channel, signal);
		if (!facts) return;
		const now = Date.now();
		const verified = verifyPendingVoucher({
			domain,
			escrow,
			fees,
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
				paymentChannelId: entry.paymentChannelId,
				sequence: entry.voucher.sequence,
				signer: this.address,
				signature,
			},
			signal,
		});
		channel.lastSigned = {
			sequence: entry.voucher.sequence,
			voucher: verified.voucher,
			signedAt: now,
		};
	}

	private async channelFacts(
		entry: PendingVoucher,
		escrow: TrustedEscrow,
		channel: ChannelState,
		signal: AbortSignal
	): Promise<ChannelFacts | undefined> {
		if (channel.facts || channel.delegated) return channel.facts;
		const { data: paymentChannel } = await getPaymentChannel({
			client: this.client,
			path: { paymentChannelId: entry.paymentChannelId },
			signal,
		});
		if (paymentChannel.signingMode !== VoucherSigningMode.Client) {
			channel.delegated = true;
			return undefined;
		}
		channel.facts = verifyChannel(
			entry,
			paymentChannel,
			this.fundingWallet,
			escrow
		);
		return channel.facts;
	}

	private report(error: unknown): void {
		this.options.onError(
			error instanceof Error ? error : new SnapflowError(String(error))
		);
	}
}
