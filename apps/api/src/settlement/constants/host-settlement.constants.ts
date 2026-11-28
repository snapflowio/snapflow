/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	SECONDS_PER_DAY,
	SECONDS_PER_HOUR,
	SECONDS_PER_MINUTE,
} from '../../common/constants/time.constants';
import { SettlementErrorCode } from './payment-channel.constants';

export const SETTLEMENT_OPERATOR = {
	JOB: 'operate-settlement',
	LOCK_TTL_SECONDS: 5 * SECONDS_PER_MINUTE,
	BATCH_SIZE: 50,
} as const;

export const HOST_WITHDRAWAL_SIGNATURE_SECONDS = {
	LIFETIME: 30 * SECONDS_PER_MINUTE,
	MINIMUM_REMAINING: 2 * SECONDS_PER_MINUTE,
	MAXIMUM_LIFETIME: SECONDS_PER_DAY,
} as const;

export const HOST_SETTLEMENT_GAS = {
	WITHDRAWAL: 180_000n,
	PER_CLAIM: 110_000n,
} as const;

export const CLAIM_BATCH_OVERHEAD_GAS = 50_000n;

export const ETH_USD_FEED_MAXIMUM_AGE_SECONDS = SECONDS_PER_HOUR;

export const PLATFORM_SETTLEMENT = {
	CLAIM_KEY: 'settle-platform-channels',
	INTERVAL_SECONDS: SECONDS_PER_DAY,
} as const;

export const HOST_SETTLEMENT_FAILURE = {
	EXPIRED: 'its deadline came before it could be sent',
	UNDERPAID: 'its relay fee no longer covers the gas at the current price',
	GAS_ABOVE_MAXIMUM_FEE:
		'its gas costs more than the most relay fee the escrow allows; settle again once gas is cheaper',
	PAYOUT_CHANGED: "the organization's payout wallet changed",
	DROPPED: 'dropped; relaying again',
} as const;

export const HostSettlementErrorCode = {
	HOST_KEY_REQUIRED: SettlementErrorCode.HOST_KEY_REQUIRED,
	PAYOUT_WALLET_REQUIRED: 'payout_wallet_required',
	PAYOUT_NOT_REQUESTED: 'payout_address_not_requested',
	CHANNEL_NOT_SETTLEABLE: 'payment_channel_not_settleable',
	SETTLEMENT_IN_FLIGHT: 'host_settlement_in_flight',
	NONCE_STALE: 'host_withdrawal_nonce_stale',
	DEADLINE_INVALID: 'host_withdrawal_deadline_invalid',
	SIGNATURE_INVALID: 'host_withdrawal_signature_invalid',
	RELAY_FEE_TOO_LOW: 'relay_fee_too_low',
	SIMULATION_FAILED: 'host_settlement_simulation_failed',
	PAYOUT_BELOW_MINIMUM: 'host_payout_below_minimum',
	RELAY_FEE_EXCEEDS_PAYOUT: 'relay_fee_exceeds_payout',
} as const;

export const DEADLINE_CLAIMS = {
	CLAIM_KEY: 'claim-host-channels-before-deadlines',
	INTERVAL_SECONDS: 15 * SECONDS_PER_MINUTE,
	NOTICE_SECONDS: SECONDS_PER_DAY,
} as const;

export const HOST_PAYOUT_CHECK_SECONDS = SECONDS_PER_MINUTE;
