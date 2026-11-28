/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BASIS_POINTS_SCALE } from '../../common/constants/money.constants';
import { BasisPoints } from '../../common/values/basis-points.value';

export const HOURS_PER_BILLING_MONTH = 730n;

export const BYTES_PER_GIBIBYTE = 1_073_741_824n;

export const HIGH_MEMORY_GIB_PER_VCPU = 8;

export const INTERRUPTIBLE_PRICE = {
	DEFAULT_BASIS_POINTS: 5_000,
	MINIMUM_BASIS_POINTS: 1,
	MAXIMUM_BASIS_POINTS: BASIS_POINTS_SCALE,
} as const;

export const MINIMUM_RELIABILITY_FOR_RANKING = BasisPoints.of(5_000);

export const PLACEMENT_RANKING = {
	PRIOR_SUCCESS_MASS: 9,
	PRIOR_WEIGHT: 10,
	PRICE_BAND_RATIO: 1.05,
} as const;

export const HOST_RATE_FIELDS = [
	'vcpuHourMicroUsd',
	'memoryGibHourMicroUsd',
	'gpuHourMicroUsd',
	'diskGibMonthMicroUsd',
] as const;

export const MARKET_PERCENTILES = {
	LOW: 0.1,
	MEDIAN: 0.5,
	HIGH: 0.9,
} as const;

export const PRIMARY_RATE = {
	GPU: { field: 'gpuHourMicroUsd', unit: 'GPU-hour' },
	CPU: { field: 'vcpuHourMicroUsd', unit: 'vCPU-hour' },
} as const;
