/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { snapflowEscrowAbi } from '@snapflow/contracts';
import {
	MILLISECONDS_PER_HOUR,
	MILLISECONDS_PER_MINUTE,
	MILLISECONDS_PER_SECOND,
	SECONDS_PER_DAY,
	SECONDS_PER_MINUTE,
} from '../../common/constants/time.constants';
import type { EscrowEventKind } from '../types/escrow.types';

export const ESCROW_EVENT_KINDS: readonly EscrowEventKind[] =
	snapflowEscrowAbi.flatMap((item) =>
		item.type === 'event' ? [item.name] : []
	);

export const CLAIM_FAILURE_REASONS = [
	'None',
	'ClaimsFrozen',
	'InvalidVoucherTerms',
	'VoucherFromFuture',
	'InvalidSignature',
	'SignerNotAuthorized',
	'SignerExpired',
	'SignerHostMismatch',
	'FeeAboveSignerLimit',
	'CustomerBlockedForVoucher',
	'ZeroAmount',
	'NothingToClaim',
	'InsufficientBalance',
	'SignerCapReached',
	'Other',
] as const;

export type ClaimFailureReason = (typeof CLAIM_FAILURE_REASONS)[number];

export const CLAIM_FAILURE_OTHER: ClaimFailureReason = 'Other';

export const ESCROW_RECONCILIATION = {
	JOB: 'reconcile-escrow',
	CLAIM_KEY: 'reconcile-escrow',
	CLAIM_SECONDS: SECONDS_PER_DAY / 2,
	ACCOUNTS_PER_MULTICALL: 100,
	REPORTED_DRIFTS: 10,
} as const;

export const ESCROW_CIRCUIT_BREAKER = {
	CLAIM_KEY: 'guard-escrow-solvency',
	INTERVAL_SECONDS: 30,
} as const;

export const SAFE_BLOCK_TAG = 'safe';
export const FINALIZED_BLOCK_TAG = 'finalized';

export const ESCROW_INDEXER = {
	JOB: 'index-escrow-events',
	LOCK_TTL_SECONDS: 5 * SECONDS_PER_MINUTE,
	ALERT_AFTER_FAILED_RUNS: 5,
	LAG_ALERT_BLOCKS: 1_800n,
	BACKOFF: {
		baseMilliseconds: 5 * MILLISECONDS_PER_SECOND,
		capMilliseconds: 5 * MILLISECONDS_PER_MINUTE,
	},
} as const;

export const ESCROW_EVENT_QUERY = {
	defaultLimit: 25,
	maximumLimit: 100,
} as const;

export const ESCROW_PENDING = {
	CACHE_MILLISECONDS: 4 * MILLISECONDS_PER_SECOND,
	CACHE_KEY_SEPARATOR: ':',
} as const;

export const ESCROW_LOG_RANGE = {
	successesBeforeGrowth: 20,
	growthFactor: 2n,
	providerLimitMilliseconds: MILLISECONDS_PER_HOUR,
} as const;

export const PENDING_WITHDRAWAL_CHANGE_KINDS = [
	'WithdrawalRequested',
	'WithdrawalCancelled',
	'Withdrawn',
] as const satisfies readonly EscrowEventKind[];

export type PendingWithdrawalChangeKind =
	(typeof PENDING_WITHDRAWAL_CHANGE_KINDS)[number];

export const HOST_PAYOUT_QUERY = {
	defaultLimit: 25,
	maximumLimit: 100,
} as const;

export const MAXIMUM_DATE_MILLISECONDS = 8_640_000_000_000_000;

export const DEPOSITED_EVENT: EscrowEventKind = 'Deposited';

export const ROLE_GRANTED_EVENT: EscrowEventKind = 'RoleGranted';

export const WITHDRAWAL_REQUESTED_EVENT: EscrowEventKind =
	'WithdrawalRequested';

export const HOST_WITHDRAWN_EVENT: EscrowEventKind = 'HostWithdrawn';

export const CLAIMED_EVENT: EscrowEventKind = 'Claimed';

export const RELAY_FEE_PAID_EVENT: EscrowEventKind = 'RelayFeePaid';
