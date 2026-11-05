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

export const POSITIVE_MICRO_USD_PATTERN = /^[1-9]\d*$/;

export const GPU_PRICE_CLASS_PREFIX = 'gpu_';

export const MACHINE_TIER_ORDER: readonly MachineTier[] = [
	MachineTier.PRIVATE,
	MachineTier.COMMUNITY,
	MachineTier.VERIFIED,
	MachineTier.DATACENTER,
];

export const MARKET_SAMPLE_TIERS: readonly MachineTier[] = [
	MachineTier.VERIFIED,
	MachineTier.DATACENTER,
];

export const MACHINE_BROWSE_CANDIDATE_LIMIT = 1_000;

export const MACHINE_BENCHMARK_HISTORY_LIMIT = 5;

export const MACHINE_BROWSE_PAGE_LIMIT = { DEFAULT: 25, MAXIMUM: 100 } as const;

export const MACHINE_BROWSE_CURSOR_SEPARATOR = ':';

export const MARKETPLACE_JOB = {
	COMPUTE_MARKET_REFERENCE_PRICES: 'compute-market-reference-prices',
} as const;

export const MARKETPLACE_ROUTE = {
	HOST_MACHINES: 'host/machines',
	MACHINE_PRICE_CARDS: '/host/machines/:machineId/price-cards',
} as const;
