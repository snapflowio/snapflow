/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MachineTier } from '../enums/machine-tier.enum';

export const MARKETPLACE_MONEY_PRECISION = 40;
const MARKETPLACE_MONEY_SCALE = 0;

export const MARKETPLACE_MONEY_COLUMN_TYPE = `numeric(${MARKETPLACE_MONEY_PRECISION},${MARKETPLACE_MONEY_SCALE})`;

export const MARKETPLACE_INITIAL_VERSION = 1;

export const SELF_USE_MARKUP_BASIS_POINTS = 0;

export const MARKUP_BASIS_POINTS_DESCRIPTION =
	"Markup added to the host price, in basis points: one rate on every tier and none on the organization's own machines";

export const POSITIVE_MICRO_USD_PATTERN = /^[1-9]\d*$/;

export const GPU_PRICE_CLASS_PREFIX = 'gpu_';

export const MACHINE_TIER_ORDER: readonly MachineTier[] = [
	MachineTier.PRIVATE,
	MachineTier.COMMUNITY,
	MachineTier.VERIFIED,
	MachineTier.DATACENTER,
];

export const MACHINE_BROWSE_CANDIDATE_LIMIT = 1_000;

export const MACHINE_BENCHMARK_HISTORY_LIMIT = 5;

export const MACHINE_BROWSE_PAGE_LIMIT = { DEFAULT: 25, MAXIMUM: 100 } as const;

export const MACHINE_BROWSE_CURSOR_SEPARATOR = ':';

export const MACHINE_BROWSE_SEARCH_MAX_LENGTH = 128;

export const MARKETPLACE_ROUTE = {
	HOST_MACHINES: 'host/machines',
	HOST_DEMAND: 'host/demand',
	MACHINE_PRICE_CARDS: '/host/machines/:machineId/price-cards',
	HOST_PROFILE: 'host/profile',
} as const;

export const UNMET_DEMAND = {
	ANY_GPU: 'any',
	KEY_SEPARATOR: ':',
	DEDUPLICATION_WINDOW_MILLISECONDS: 10 * 60 * 1_000,
	SUMMARY_DAYS: 7,
	SUMMARY_LIMIT: 20,
	RETENTION_DAYS: 90,
} as const;

export const IDLE_MACHINE_NOTICE = {
	JOB: 'notify-idle-machines',
	KEY: 'machine-idle',
	MINIMUM_LISTED_DAYS: 7,
	IDLE_BELOW_BASIS_POINTS: 500,
	BATCH_SIZE: 500,
} as const;
