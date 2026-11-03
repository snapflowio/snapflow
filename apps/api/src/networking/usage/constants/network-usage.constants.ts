/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const NETWORK_USAGE_RATING = {
	JOB: 'rate-network-usage',
	LOCK_TTL_SECONDS: 600,
	SETTLE_MILLISECONDS: 5 * 60 * 1_000,
	PERIOD_MILLISECONDS: 60 * 60 * 1_000,
	EVIDENCE_BATCH_SIZE: 5_000,
	MAXIMUM_BATCHES_PER_RUN: 20,
} as const;

export const NETWORK_USAGE_QUERY = {
	defaultLimit: 50,
	maximumLimit: 100,
} as const;

export const NETWORK_USAGE_MAXIMUM_COUNTER = 9_223_372_036_854_775_807n;
export const NETWORK_USAGE_NUMERIC_PRECISION = 40;
export const NETWORK_USAGE_NUMERIC_SCALE = 0;

export const NETWORK_BUDGET = {
	JOB: 'enforce-network-budgets',
	LOCK_TTL_SECONDS: 300,
	BATCH_SIZE: 500,
	ALERT_THRESHOLDS_BASIS_POINTS: [5_000, 8_000, 10_000],
	EXHAUSTED_BASIS_POINTS: 10_000,
} as const;
