/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const USAGE_ACCOUNTING_POLICY_VERSION = 2;
export const USAGE_MONEY_SCALE = 0;
export const USAGE_RESOURCE_SCALE = 6;
export const USAGE_COUNTER_SCALE = 0;
export const USAGE_ZERO_QUANTITY = '0';
export const INITIAL_USAGE_RECEIPT_COUNT = 0;
export const INITIAL_RECONCILE_ATTEMPTS = 0;

export const USAGE_NUMERIC_PRECISION = {
	DURATION: 30,
	RESOURCE: 20,
	QUANTITY: 40,
	MONEY: 40,
} as const;

export const USAGE_RECONCILIATION = {
	BATCH_SIZE: 100,
	STREAM_CHUNK_SIZE: 100,
} as const;

export const RECONCILIATION_SCHEDULE = {
	POLL_INTERVAL_MILLISECONDS: 60_000,
	BACKOFF_BASE_MILLISECONDS: 60_000,
	BACKOFF_MULTIPLIER: 2,
	BACKOFF_MAXIMUM_MILLISECONDS: 3_600_000,
} as const;
