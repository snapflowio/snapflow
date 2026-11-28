/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MICRO_USD_PER_USD } from '#lib/utils/usd.ts';

export const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
export const MINUTES_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR;
const DEFAULT_WINDOW_START_HOUR = 4;
const DEFAULT_WINDOW_HOURS = 2;
const DEFAULT_UNCLAIMED_FLOAT_USDC = 25n;
const MAXIMUM_UNCLAIMED_FLOAT_USDC = 1_000_000n;

export const MAINTENANCE_WINDOW_LIMITS = {
	MINIMUM_DURATION_MINUTES: MINUTES_PER_HOUR,
	MAXIMUM_DURATION_MINUTES: (HOURS_PER_DAY / 2) * MINUTES_PER_HOUR,
} as const;

export const DEFAULT_MAINTENANCE_WINDOW = {
	startMinuteUtc: DEFAULT_WINDOW_START_HOUR * MINUTES_PER_HOUR,
	durationMinutes: DEFAULT_WINDOW_HOURS * MINUTES_PER_HOUR,
} as const;

export const MACHINE_OFFER_LIMITS = {
	MINIMUM: 1,
	MAXIMUM_VCPUS: 1_024,
	MAXIMUM_MEMORY_GIB: 16_384,
	MAXIMUM_DISK_GIB: 1_048_576,
} as const;

export const UNCLAIMED_FLOAT_LIMITS = {
	DEFAULT_BASE_UNITS: DEFAULT_UNCLAIMED_FLOAT_USDC * MICRO_USD_PER_USD,
	MAXIMUM_BASE_UNITS: MAXIMUM_UNCLAIMED_FLOAT_USDC * MICRO_USD_PER_USD,
} as const;
