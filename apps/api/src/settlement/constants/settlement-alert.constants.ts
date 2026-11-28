/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	MILLISECONDS_PER_SECOND,
	SECONDS_PER_HOUR,
	SECONDS_PER_MINUTE,
} from '../../common/constants/time.constants';

export const SETTLEMENT_ALERT = {
	CLAIM_KEY_PREFIX: 'settlement-alert:',
	REPEAT_SECONDS: SECONDS_PER_HOUR,
	REQUEST_TIMEOUT_MILLISECONDS: 10 * MILLISECONDS_PER_SECOND,
	SUMMARY_MAXIMUM_LENGTH: 1_000,
	ALERTMANAGER_ALERTS_PATH: '/api/v2/alerts',
	ALERT_NAME: 'SettlementAlert',
	ALERT_ID_LABEL: 'alert_id',
	SEVERITY: 'critical',
} as const;

export const SettlementAlertKind = {
	CHAIN_IDENTITY_MISMATCH: 'chain-identity-mismatch',
	CHAIN_UNREACHABLE: 'chain-unreachable',
	DEADLINE_CLAIM_FAILED: 'deadline-claim-failed',
	DEADLINE_CLAIM_UNPAID: 'deadline-claim-unpaid',
	ESCROW_INDEXER_FAILING: 'escrow-indexer-failing',
	ESCROW_INSOLVENT: 'escrow-insolvent',
	ESCROW_INDEXER_LAGGING: 'escrow-indexer-lagging',
	ESCROW_RECONCILIATION_DRIFT: 'escrow-reconciliation-drift',
	ESCROW_RECONCILIATION_FAILED: 'escrow-reconciliation-failed',
	REFUNDS_DUE: 'refunds-due',
	RELAYER_BALANCE_LOW: 'relayer-balance-low',
	RELAYER_FEE_CAP_REACHED: 'relayer-fee-cap-reached',
	RELAYER_TRANSACTION_STALLED: 'relayer-transaction-stalled',
	SANCTIONS_DELISTED: 'sanctions-delisted',
	SANCTIONS_LIST_STALE: 'sanctions-list-stale',
	SANCTIONS_MATCH: 'sanctions-match',
} as const;

export type SettlementAlertKind =
	(typeof SettlementAlertKind)[keyof typeof SettlementAlertKind];

export const RELAYER_HEALTH = {
	CLAIM_KEY: 'check-settlement-relayer-health',
	INTERVAL_SECONDS: 5 * SECONDS_PER_MINUTE,
	RUNWAY_CLAIM_BATCHES: 50n,
	STALLED_TRANSACTION_SECONDS: 10 * SECONDS_PER_MINUTE,
} as const;
