/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MicroUsd } from '../../common/values/micro-usd.value';
import type { SettingsSnapshot } from '../../settings/types/settings.types';
import { PRICED_RESOURCE_RATES } from '../constants/pricing.constants';
import { PricedResource } from '../enums/priced-resource.enum';
import type { PriceCardRates } from '../types/pricing.types';

type LimitKey = keyof SettingsSnapshot &
	`${string}Price${'Minimum' | 'Maximum'}MicroUsd`;

export type PriceLimitSettings = Pick<SettingsSnapshot, LimitKey>;

interface PriceLimit {
	resource: PricedResource;
	minimum: LimitKey;
	maximum: LimitKey;
	gpuOnly: boolean;
}

// Egress is not here: its market ceiling bounds it and free egress is fine.
// The GPU rate only matters, and is only bounded, on machines with GPUs.
const PRICE_LIMITS: readonly PriceLimit[] = [
	{
		resource: PricedResource.VCPU_HOUR,
		minimum: 'vcpuHourPriceMinimumMicroUsd',
		maximum: 'vcpuHourPriceMaximumMicroUsd',
		gpuOnly: false,
	},
	{
		resource: PricedResource.MEMORY_GIB_HOUR,
		minimum: 'memoryGibHourPriceMinimumMicroUsd',
		maximum: 'memoryGibHourPriceMaximumMicroUsd',
		gpuOnly: false,
	},
	{
		resource: PricedResource.GPU_HOUR,
		minimum: 'gpuHourPriceMinimumMicroUsd',
		maximum: 'gpuHourPriceMaximumMicroUsd',
		gpuOnly: true,
	},
	{
		resource: PricedResource.DISK_GIB_MONTH,
		minimum: 'diskGibMonthPriceMinimumMicroUsd',
		maximum: 'diskGibMonthPriceMaximumMicroUsd',
		gpuOnly: false,
	},
	{
		resource: PricedResource.STOPPED_DISK_GIB_MONTH,
		minimum: 'diskGibMonthPriceMinimumMicroUsd',
		maximum: 'diskGibMonthPriceMaximumMicroUsd',
		gpuOnly: false,
	},
];

export interface PriceRangeViolation {
	resource: PricedResource;
	priceMicroUsd: MicroUsd;
	minimumMicroUsd: MicroUsd;
	maximumMicroUsd: MicroUsd;
}

// The first rate of a price card outside its resource's sanity limits.
export function priceRangeViolation(
	rates: PriceCardRates,
	limits: PriceLimitSettings,
	gpuCount: number
): PriceRangeViolation | null {
	for (const limit of PRICE_LIMITS) {
		if (limit.gpuOnly && gpuCount === 0) continue;
		const priceMicroUsd = MicroUsd.parse(
			rates[PRICED_RESOURCE_RATES[limit.resource]]
		);
		const minimumMicroUsd = MicroUsd.of(BigInt(limits[limit.minimum]));
		const maximumMicroUsd = MicroUsd.of(BigInt(limits[limit.maximum]));
		if (
			priceMicroUsd.lessThan(minimumMicroUsd) ||
			priceMicroUsd.greaterThan(maximumMicroUsd)
		) {
			return {
				resource: limit.resource,
				priceMicroUsd,
				minimumMicroUsd,
				maximumMicroUsd,
			};
		}
	}
	return null;
}
