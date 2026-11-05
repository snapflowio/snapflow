/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BILLING_POLICY } from '../../billing/constants/billing-policy.constants';
import {
	HOURS_PER_DAY,
	MILLISECONDS_PER_HOUR,
	MILLISECONDS_PER_MINUTE,
	SECONDS_PER_MINUTE,
} from '../../common/constants/time.constants';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { VoucherRejection } from '../enums/voucher-rejection.enum';

export const VOUCHER_ISSUER = {
	JOB: 'issue-settlement-vouchers',
	LOCK_TTL_SECONDS: 5 * SECONDS_PER_MINUTE,
	// Channels evaluated per run; the job runs every few seconds, so a backlog
	// drains quickly without one run holding the lock for long.
	BATCH_SIZE: 100,
} as const;

export const CLAIM_RELAYER = {
	JOB: 'relay-voucher-claims',
	// Every claim in a batch adds calldata and gas; twenty stay far below a
	// Base block's gas limit while amortizing the transaction overhead.
	MAXIMUM_BATCH_SIZE: 20,
	RECEIPT_TIMEOUT_MILLISECONDS: 2 * MILLISECONDS_PER_MINUTE,
	// Longer than a run that waits the whole receipt timeout, so a second
	// worker can never send a batch while the first still waits.
	LOCK_TTL_SECONDS: 5 * SECONDS_PER_MINUTE,
} as const;

export const ClaimFailure = {
	BATCH_REVERTED: 'claim_batch_reverted',
	TRANSACTION_DROPPED: 'claim_transaction_dropped',
} as const;

export type ClaimFailure = (typeof ClaimFailure)[keyof typeof ClaimFailure];

// Long-poll topic the machine voucher relay waits on, keyed by machine id.
export const SETTLEMENT_VOUCHER_WAKE_TOPIC = 'settlement-vouchers';

export const PAYMENT_CHANNEL_QUERY = {
	defaultLimit: 25,
	maximumLimit: 100,
} as const;

// The escrow's EscrowLimits.SESSION_RATE_WINDOW: a session key may spend its
// hourly cap once per started hour since it was activated.
export const SESSION_RATE_WINDOW_MILLISECONDS = MILLISECONDS_PER_HOUR;

// Usage is billed in arrears, one accounting window at a time, so a lease's
// last charges land up to a window after it ends; the final voucher waits
// that long before closing the channel.
export const CHANNEL_SETTLE_DELAY_MILLISECONDS =
	BILLING_POLICY.accountingWindowMinutes * MILLISECONDS_PER_MINUTE;

export const DELEGATION_SUGGESTION = {
	// A key is charged for everything unclaimed when its first claim lands,
	// which is up to a claim interval plus the hour being billed; three hours
	// of the current run rate absorb that and a burst of new sandboxes.
	hourlyCapRunRateHours: 3n,
	spendCapRunRateHours: 30n * BigInt(HOURS_PER_DAY),
	expiryDays: 30,
	// The escrow refuses a zero cap, and an organization with nothing running
	// yet still needs room for its first sandbox.
	minimumHourlyCapMicroUsd: MicroUsd.of(1_000_000n),
} as const;

export const PaymentChannelErrorCode = {
	CHANNEL_NOT_FOUND: 'payment_channel_not_found',
	VOUCHER_NOT_FOUND: 'voucher_not_found',
	VOUCHER_ALREADY_SIGNED: 'voucher_already_signed',
	VOUCHER_SUPERSEDED: 'voucher_superseded',
	VOUCHER_EXPIRED: 'voucher_expired',
} as const;

export const VOUCHER_REJECTION_MESSAGES: Readonly<
	Record<VoucherRejection, string>
> = {
	[VoucherRejection.SIGNATURE_INVALID]:
		'The signature does not recover to the claimed signer',
	[VoucherRejection.SIGNER_NOT_AUTHORIZED]:
		'The signer is neither the funding wallet nor one of its session keys',
	[VoucherRejection.SESSION_KEY_INACTIVE]:
		'The session key was revoked or has expired',
	[VoucherRejection.SESSION_SPEND_CAP_EXCEEDED]:
		"The voucher would exceed the session key's spend cap",
	[VoucherRejection.SESSION_HOURLY_CAP_EXCEEDED]:
		"The voucher would exceed the session key's hourly cap",
};

export const CHANNEL_ID_PATTERN = /^0x[0-9a-fA-F]{64}$/;
