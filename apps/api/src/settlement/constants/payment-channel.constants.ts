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
	MILLISECONDS_PER_MINUTE,
	SECONDS_PER_MINUTE,
} from '../../common/constants/time.constants';

export const VOUCHER_ISSUER = {
	JOB: 'issue-settlement-vouchers',
	LOCK_TTL_SECONDS: 5 * SECONDS_PER_MINUTE,
	BATCH_SIZE: 100,
} as const;

export const PLATFORM_SERVICE_BILLER = {
	JOB: 'bill-platform-services',
	LOCK_TTL_SECONDS: 5 * SECONDS_PER_MINUTE,
} as const;

export const CHARGE_SETTLE_DELAY_MILLISECONDS =
	BILLING_POLICY.accountingWindowMinutes * MILLISECONDS_PER_MINUTE;

export const SETTLEMENT_WAKE_TOPIC = 'settlement-channels';

export const MACHINE_SETTLEMENT_DOCUMENT_VERSION = 5;

export const PAYMENT_CHANNEL_QUERY = {
	defaultLimit: 25,
	maximumLimit: 100,
} as const;

export const SettlementErrorCode = {
	CHANNEL_NOT_FOUND: 'payment_channel_not_found',
	VOUCHER_NOT_FOUND: 'voucher_not_found',
	VOUCHER_ALREADY_SIGNED: 'voucher_already_signed',
	VOUCHER_SUPERSEDED: 'voucher_superseded',
	SIGNATURE_INVALID: 'voucher_signature_invalid',
	SIGNER_NOT_USABLE: 'voucher_signer_not_usable',
	SIGNER_CAP_EXCEEDED: 'voucher_signer_cap_exceeded',
	FUNDING_WALLET_REQUIRED: 'funding_wallet_required',
	DELEGATED_SIGNER_UNAVAILABLE: 'delegated_signer_unavailable',
	DELEGATED_SIGNER_ALREADY_AUTHORIZED: 'delegated_signer_already_authorized',
	AUTOMATIC_PAYMENTS_REQUIRED: 'automatic_payments_required',
	HOST_KEY_REQUIRED: 'machine_host_key_required',
	CHAIN_UNAVAILABLE: 'settlement_chain_unavailable',
	REFUND_NOT_DUE: 'payment_channel_refund_not_due',
	REFUND_ALREADY_RECORDED: 'payment_channel_refund_already_recorded',
	REFUND_AMOUNT_CHANGED: 'payment_channel_refund_amount_changed',
} as const;

export type SettlementErrorCode =
	(typeof SettlementErrorCode)[keyof typeof SettlementErrorCode];

export type VoucherRejectionCode =
	| typeof SettlementErrorCode.SIGNATURE_INVALID
	| typeof SettlementErrorCode.SIGNER_NOT_USABLE
	| typeof SettlementErrorCode.SIGNER_CAP_EXCEEDED;

export const VOUCHER_REJECTION_MESSAGES: Readonly<
	Record<VoucherRejectionCode, string>
> = {
	[SettlementErrorCode.SIGNATURE_INVALID]:
		'The signature does not verify for the claimed signer',
	[SettlementErrorCode.SIGNER_NOT_USABLE]:
		"The signer is not an active key of the funding wallet whose scope covers this channel's host and fee",
	[SettlementErrorCode.SIGNER_CAP_EXCEEDED]:
		"The voucher would exceed the signer key's caps",
};
