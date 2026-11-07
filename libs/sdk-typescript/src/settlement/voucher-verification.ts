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
	type EscrowDomain as ApiEscrowDomain,
	type PaymentChannel,
	PaymentChannelKind,
	type PendingVoucher,
} from '@snapflow/api-client';
import {
	channelIdFor,
	ESCROW_DOMAIN_NAME,
	ESCROW_DOMAIN_VERSION,
	type EscrowDomain,
	escrowDomain,
	type Voucher,
} from '@snapflow/contracts';
import {
	type Address,
	getAddress,
	type Hex,
	isAddress,
	isAddressEqual,
	isHex,
	size,
} from 'viem';
import {
	SnapflowVoucherRejectedError,
	VoucherRejectionReason,
} from '../errors/settlement-error.js';
import { MILLISECONDS_PER_SECOND } from '../utils/timeout.js';
import {
	type SpendAnchor,
	spendPolicyViolation,
	type VoucherSpendPolicy,
} from './spend-policy.js';

const CHANNEL_ID_BYTES = 32;
const UNSIGNED_INTEGER_PATTERN = /^\d+$/;

/** What the SDK verified about a client-signed lease channel when it first saw it. */
export interface ChannelFacts {
	channelId: Hex;
	customer: Address;
	host: Address;
	leaseId: string;
	sandboxId: string;
	openedAt: number;
}

export interface SignedVoucherRecord {
	voucher: Voucher;
	signedAt: number;
}

/** The escrow the signer trusts, from the organization's escrow account. */
export type TrustedEscrow = Pick<EscrowDomain, 'chainId' | 'verifyingContract'>;

export interface VoucherVerification {
	domain: ApiEscrowDomain;
	escrow: TrustedEscrow;
	entry: PendingVoucher;
	channel: ChannelFacts;
	lastSigned: SignedVoucherRecord | undefined;
	policy: VoucherSpendPolicy;
	now: number;
}

/** A voucher that passed verification, with the trusted domain to sign it under. */
export interface VerifiedVoucher {
	domain: EscrowDomain;
	voucher: Voucher;
}

export function rejectVoucher(
	entry: PendingVoucher,
	reason: VoucherRejectionReason,
	message: string
): SnapflowVoucherRejectedError {
	return new SnapflowVoucherRejectedError(
		`Refused to sign voucher ${entry.voucher.sequence} of channel ${entry.channelId}: ${message}`,
		{
			channelId: entry.channelId,
			sequence: entry.voucher.sequence,
			reason,
		}
	);
}

function parseChannelId(entry: PendingVoucher, value: string): Hex {
	if (!(isHex(value) && size(value) === CHANNEL_ID_BYTES)) {
		throw rejectVoucher(
			entry,
			VoucherRejectionReason.Malformed,
			`invalid channel id ${value}`
		);
	}
	return value;
}

function parseAddress(entry: PendingVoucher, value: string): Address {
	if (!isAddress(value, { strict: false })) {
		throw rejectVoucher(
			entry,
			VoucherRejectionReason.Malformed,
			`invalid address ${value}`
		);
	}
	return getAddress(value);
}

function parseUnsigned(entry: PendingVoucher, value: string): bigint {
	if (!UNSIGNED_INTEGER_PATTERN.test(value)) {
		throw rejectVoucher(
			entry,
			VoucherRejectionReason.Malformed,
			`invalid unsigned integer ${value}`
		);
	}
	return BigInt(value);
}

function parseTimestamp(entry: PendingVoucher, value: string): number {
	const timestamp = Date.parse(value);
	if (Number.isNaN(timestamp)) {
		throw rejectVoucher(
			entry,
			VoucherRejectionReason.Malformed,
			`invalid timestamp ${value}`
		);
	}
	return timestamp;
}

function sameChannelId(left: string, right: string): boolean {
	return left.toLowerCase() === right.toLowerCase();
}

/**
 * Verifies a channel Snapflow reports for a pending voucher: a lease channel
 * of the expected funding wallet whose id is derived from its parties and
 * lease, so a voucher can only ever pay that lease's host.
 */
export function verifyChannel(
	entry: PendingVoucher,
	channel: PaymentChannel,
	fundingWallet: Address
): ChannelFacts {
	const channelMismatch = (message: string) =>
		rejectVoucher(entry, VoucherRejectionReason.ChannelMismatch, message);
	const channelId = parseChannelId(entry, entry.channelId);
	if (!sameChannelId(channel.channelId, channelId)) {
		throw channelMismatch('the API returned another channel');
	}
	if (
		channel.kind !== PaymentChannelKind.Lease ||
		channel.leaseId === null ||
		channel.sandboxId === null ||
		channel.leaseId !== entry.leaseId ||
		channel.sandboxId !== entry.sandboxId
	) {
		throw channelMismatch('the channel is not the lease of the sandbox');
	}
	const customer = parseAddress(entry, channel.customerAddress);
	if (!isAddressEqual(customer, fundingWallet)) {
		throw rejectVoucher(
			entry,
			VoucherRejectionReason.CustomerMismatch,
			`the channel is paid by ${customer}, not ${fundingWallet}`
		);
	}
	const host = parseAddress(entry, channel.hostAddress);
	if (
		!sameChannelId(channelIdFor(customer, host, channel.leaseId), channelId)
	) {
		throw channelMismatch('the channel id does not derive from its lease');
	}
	return {
		channelId,
		customer,
		host,
		leaseId: channel.leaseId,
		sandboxId: channel.sandboxId,
		openedAt: parseTimestamp(entry, channel.openedAt),
	};
}

/** Verifies the voucher's EIP-712 domain is the escrow the signer trusts and returns that domain. */
function verifyDomain(
	entry: PendingVoucher,
	domain: ApiEscrowDomain,
	escrow: TrustedEscrow
): EscrowDomain {
	if (
		domain.name !== ESCROW_DOMAIN_NAME ||
		domain.version !== ESCROW_DOMAIN_VERSION ||
		domain.chainId !== escrow.chainId ||
		!isAddressEqual(
			parseAddress(entry, domain.verifyingContract),
			escrow.verifyingContract
		)
	) {
		throw rejectVoucher(
			entry,
			VoucherRejectionReason.DomainMismatch,
			`the EIP-712 domain ${domain.name} ${domain.version} on chain ${domain.chainId} at ${domain.verifyingContract} is not the escrow Snapflow reports`
		);
	}
	return escrowDomain(escrow.chainId, escrow.verifyingContract);
}

export function parseVoucher(entry: PendingVoucher): Voucher {
	const { message } = entry.voucher;
	const voucher: Voucher = {
		channelId: parseChannelId(entry, message.channelId),
		customer: parseAddress(entry, message.customer),
		host: parseAddress(entry, message.host),
		hostAmount: parseUnsigned(entry, message.hostAmount),
		feeAmount: parseUnsigned(entry, message.feeAmount),
		serviceAmount: parseUnsigned(entry, message.serviceAmount),
		sequence: parseUnsigned(entry, message.sequence),
		expiry: parseUnsigned(entry, message.expiry),
	};
	if (voucher.sequence !== BigInt(entry.voucher.sequence)) {
		throw rejectVoucher(
			entry,
			VoucherRejectionReason.Malformed,
			'the message sequence differs from the voucher sequence'
		);
	}
	return voucher;
}

function voucherTotal(voucher: Voucher): bigint {
	return voucher.hostAmount + voucher.feeAmount + voucher.serviceAmount;
}

function assertBoundToChannel(
	entry: PendingVoucher,
	voucher: Voucher,
	channel: ChannelFacts
): void {
	if (
		!sameChannelId(voucher.channelId, channel.channelId) ||
		!isAddressEqual(voucher.host, channel.host)
	) {
		throw rejectVoucher(
			entry,
			VoucherRejectionReason.ChannelMismatch,
			'the voucher names another channel or host'
		);
	}
	if (!isAddressEqual(voucher.customer, channel.customer)) {
		throw rejectVoucher(
			entry,
			VoucherRejectionReason.CustomerMismatch,
			`the voucher is paid by ${voucher.customer}, not ${channel.customer}`
		);
	}
}

function assertAdvances(
	entry: PendingVoucher,
	voucher: Voucher,
	last: Voucher
): void {
	if (voucher.sequence <= last.sequence) {
		throw rejectVoucher(
			entry,
			VoucherRejectionReason.StaleSequence,
			`sequence ${voucher.sequence} does not follow the signed ${last.sequence}`
		);
	}
	if (
		voucher.hostAmount < last.hostAmount ||
		voucher.feeAmount < last.feeAmount ||
		voucher.serviceAmount < last.serviceAmount
	) {
		throw rejectVoucher(
			entry,
			VoucherRejectionReason.AmountDecreased,
			'an amount is lower than in the last signed voucher'
		);
	}
}

/**
 * Verifies a pending voucher before it is signed and returns the typed
 * message to sign; throws a SnapflowVoucherRejectedError otherwise.
 */
export function verifyPendingVoucher({
	domain,
	escrow,
	entry,
	channel,
	lastSigned,
	policy,
	now,
}: VoucherVerification): VerifiedVoucher {
	const typedDomain = verifyDomain(entry, domain, escrow);
	const voucher = parseVoucher(entry);
	assertBoundToChannel(entry, voucher, channel);
	if (voucher.expiry * BigInt(MILLISECONDS_PER_SECOND) <= BigInt(now)) {
		throw rejectVoucher(
			entry,
			VoucherRejectionReason.Expired,
			`the voucher expired at ${voucher.expiry}`
		);
	}
	const anchors: SpendAnchor[] = [{ total: 0n, at: channel.openedAt }];
	if (lastSigned) {
		assertAdvances(entry, voucher, lastSigned.voucher);
		anchors.push({
			total: voucherTotal(lastSigned.voucher),
			at: lastSigned.signedAt,
		});
	}
	const violation = spendPolicyViolation(
		policy,
		voucherTotal(voucher),
		anchors,
		now
	);
	if (violation) {
		throw rejectVoucher(
			entry,
			violation,
			`a total of ${voucherTotal(voucher)} exceeds the spend policy`
		);
	}
	return { domain: typedDomain, voucher };
}
