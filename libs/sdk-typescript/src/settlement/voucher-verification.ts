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

import type {
	EscrowDomain as ApiEscrowDomain,
	PaymentChannel,
	PendingVoucher,
} from '@snapflow/api-client';
import {
	type ChannelTerms,
	channelIdOf,
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
import {
	MILLISECONDS_PER_SECOND,
	SECONDS_PER_MINUTE,
} from '../utils/timeout.js';
import type { SettlementFees } from './settlement-fees.js';
import {
	type SpendAnchor,
	spendPolicyViolation,
	type VoucherSpendPolicy,
} from './spend-policy.js';

const BYTES32_SIZE = 32;
const UNSIGNED_INTEGER_PATTERN = /^\d+$/;
const CLOCK_SKEW_MINUTES = 5n;
export const VOUCHER_CLOCK_SKEW_SECONDS =
	CLOCK_SKEW_MINUTES * BigInt(SECONDS_PER_MINUTE);

export interface ChannelFacts {
	paymentChannelId: string;
	channelId: Hex;
	terms: ChannelTerms;
	openedAt: number;
}

export interface SignedVoucherRecord {
	sequence: number;
	voucher: Voucher;
	signedAt: number;
}

export type TrustedEscrow = Pick<EscrowDomain, 'chainId' | 'verifyingContract'>;

export interface VoucherVerification {
	domain: ApiEscrowDomain;
	escrow: TrustedEscrow;
	fees: SettlementFees;
	entry: PendingVoucher;
	channel: ChannelFacts;
	lastSigned: SignedVoucherRecord | undefined;
	policy: VoucherSpendPolicy;
	now: number;
}

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
		`Refused to sign voucher ${entry.voucher.sequence} of channel ${entry.paymentChannelId}: ${message}`,
		{
			paymentChannelId: entry.paymentChannelId,
			sequence: entry.voucher.sequence,
			reason,
		}
	);
}

function malformed(entry: PendingVoucher, message: string) {
	return rejectVoucher(entry, VoucherRejectionReason.Malformed, message);
}

function parseBytes32(entry: PendingVoucher, value: string): Hex {
	if (!(isHex(value) && size(value) === BYTES32_SIZE)) {
		throw malformed(entry, `invalid bytes32 ${value}`);
	}
	return value;
}

function parseAddress(entry: PendingVoucher, value: string): Address {
	if (!isAddress(value, { strict: false })) {
		throw malformed(entry, `invalid address ${value}`);
	}
	return getAddress(value);
}

function parseUnsigned(entry: PendingVoucher, value: string): bigint {
	if (!UNSIGNED_INTEGER_PATTERN.test(value)) {
		throw malformed(entry, `invalid unsigned integer ${value}`);
	}
	return BigInt(value);
}

function parseTime(entry: PendingVoucher, value: string): number {
	const milliseconds = Date.parse(value);
	if (Number.isNaN(milliseconds)) {
		throw malformed(entry, `invalid timestamp ${value}`);
	}
	return milliseconds;
}

function sameTerms(left: ChannelTerms, right: ChannelTerms): boolean {
	return (
		isAddressEqual(left.customer, right.customer) &&
		isAddressEqual(left.host, right.host) &&
		isAddressEqual(left.feeReceiver, right.feeReceiver) &&
		left.feeBps === right.feeBps &&
		left.salt.toLowerCase() === right.salt.toLowerCase()
	);
}

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

export function verifyChannel(
	entry: PendingVoucher,
	channel: PaymentChannel,
	fundingWallet: Address,
	escrow: TrustedEscrow
): ChannelFacts {
	const channelMismatch = (message: string) =>
		rejectVoucher(entry, VoucherRejectionReason.ChannelMismatch, message);
	if (channel.id !== entry.paymentChannelId) {
		throw channelMismatch('the API returned another channel');
	}
	const terms: ChannelTerms = {
		customer: parseAddress(entry, channel.customerAddress),
		host: parseAddress(entry, channel.hostAddress),
		feeReceiver: parseAddress(entry, channel.feeReceiverAddress),
		feeBps: channel.feeBps,
		salt: parseBytes32(entry, channel.salt),
	};
	if (!isAddressEqual(terms.customer, fundingWallet)) {
		throw rejectVoucher(
			entry,
			VoucherRejectionReason.CustomerMismatch,
			`the channel is paid by ${terms.customer}, not ${fundingWallet}`
		);
	}
	const channelId = channelIdOf(
		escrowDomain(escrow.chainId, escrow.verifyingContract),
		terms
	);
	if (channelId.toLowerCase() !== channel.channelId.toLowerCase()) {
		throw channelMismatch(
			`the channel id ${channel.channelId} does not match its terms`
		);
	}
	return {
		paymentChannelId: channel.id,
		channelId,
		terms,
		openedAt: parseTime(entry, channel.createdAt),
	};
}

export function parseVoucher(entry: PendingVoucher): Voucher {
	const { message } = entry.voucher;
	return {
		customer: parseAddress(entry, message.customer),
		host: parseAddress(entry, message.host),
		feeReceiver: parseAddress(entry, message.feeReceiver),
		feeBps: message.feeBps,
		salt: parseBytes32(entry, message.salt),
		cumulativeAmount: parseUnsigned(entry, message.cumulativeAmount),
		timestamp: parseUnsigned(entry, message.timestamp),
		metadata: parseBytes32(entry, message.metadata),
	};
}

function assertChargedFees(
	entry: PendingVoucher,
	voucher: Voucher,
	fees: SettlementFees
): void {
	if (
		!isAddressEqual(voucher.feeReceiver, fees.feeReceiver) ||
		voucher.feeBps !== fees.feeBps
	) {
		throw rejectVoucher(
			entry,
			VoucherRejectionReason.FeeMismatch,
			`the voucher pays a fee of ${voucher.feeBps} basis points to ${voucher.feeReceiver}, not the ${fees.feeBps} basis points to ${fees.feeReceiver} Snapflow charges`
		);
	}
}

function assertNotAhead(
	entry: PendingVoucher,
	voucher: Voucher,
	now: number
): void {
	const nowSeconds = BigInt(Math.floor(now / MILLISECONDS_PER_SECOND));
	if (voucher.timestamp > nowSeconds + VOUCHER_CLOCK_SKEW_SECONDS) {
		throw rejectVoucher(
			entry,
			VoucherRejectionReason.TimestampOutOfRange,
			`the voucher is stamped ${voucher.timestamp}, in the future`
		);
	}
}

function assertAdvances(
	entry: PendingVoucher,
	voucher: Voucher,
	last: SignedVoucherRecord
): void {
	if (entry.voucher.sequence <= last.sequence) {
		throw rejectVoucher(
			entry,
			VoucherRejectionReason.StaleSequence,
			`sequence ${entry.voucher.sequence} does not follow the signed ${last.sequence}`
		);
	}
	if (voucher.cumulativeAmount < last.voucher.cumulativeAmount) {
		throw rejectVoucher(
			entry,
			VoucherRejectionReason.AmountDecreased,
			`the cumulative amount ${voucher.cumulativeAmount} is below the signed ${last.voucher.cumulativeAmount}`
		);
	}
	if (voucher.timestamp < last.voucher.timestamp) {
		throw rejectVoucher(
			entry,
			VoucherRejectionReason.TimestampOutOfRange,
			'the voucher is stamped before the last signed one'
		);
	}
}

export function verifyPendingVoucher({
	domain,
	escrow,
	fees,
	entry,
	channel,
	lastSigned,
	policy,
	now,
}: VoucherVerification): VerifiedVoucher {
	const typedDomain = verifyDomain(entry, domain, escrow);
	const voucher = parseVoucher(entry);
	assertChargedFees(entry, voucher, fees);
	if (!sameTerms(voucher, channel.terms)) {
		throw rejectVoucher(
			entry,
			VoucherRejectionReason.ChannelMismatch,
			"the voucher's customer, host, fee receiver, fee or salt differ from its channel"
		);
	}
	assertNotAhead(entry, voucher, now);
	const anchors: SpendAnchor[] = [{ total: 0n, at: channel.openedAt }];
	if (lastSigned) {
		assertAdvances(entry, voucher, lastSigned);
		anchors.push({
			total: lastSigned.voucher.cumulativeAmount,
			at: lastSigned.signedAt,
		});
	}
	const violation = spendPolicyViolation(
		policy,
		voucher.cumulativeAmount,
		anchors,
		now
	);
	if (violation) {
		throw rejectVoucher(
			entry,
			violation,
			`a total of ${voucher.cumulativeAmount} exceeds the spend policy`
		);
	}
	return { domain: typedDomain, voucher };
}
