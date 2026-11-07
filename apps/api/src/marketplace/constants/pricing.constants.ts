/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BasisPoints } from '../../common/values/basis-points.value';
import { ResourceShape } from '../../common/values/resource-shape.value';
import { MachineCategory } from '../enums/machine-category.enum';
import { PricedResource } from '../enums/priced-resource.enum';
import type { PriceCardRates } from '../types/pricing.types';

export const HOURS_PER_BILLING_MONTH = 730n;

export const PRICED_RESOURCE_RATES: Readonly<
	Record<PricedResource, keyof PriceCardRates>
> = {
	[PricedResource.VCPU_HOUR]: 'vcpuHourMicroUsd',
	[PricedResource.MEMORY_GIB_HOUR]: 'memoryGibHourMicroUsd',
	[PricedResource.GPU_HOUR]: 'gpuHourMicroUsd',
	[PricedResource.DISK_GIB_MONTH]: 'diskGibMonthMicroUsd',
	[PricedResource.STOPPED_DISK_GIB_MONTH]: 'stoppedDiskGibMonthMicroUsd',
	[PricedResource.EGRESS_GIB]: 'egressMicroUsdPerGiB',
};

export const BYTES_PER_GIBIBYTE = 1_073_741_824n;

export const EGRESS_PRICE_CLASS = 'egress';

export const REFERENCE_SHAPES: Readonly<
	Record<MachineCategory, ResourceShape>
> = {
	[MachineCategory.GENERAL]: ResourceShape.of({
		cpu: 2,
		memoryGiB: 4,
		diskGiB: 20,
		gpu: 0,
	}),
	[MachineCategory.HIGH_MEMORY]: ResourceShape.of({
		cpu: 2,
		memoryGiB: 16,
		diskGiB: 20,
		gpu: 0,
	}),
	[MachineCategory.GPU]: ResourceShape.of({
		cpu: 8,
		memoryGiB: 64,
		diskGiB: 200,
		gpu: 1,
	}),
};

export const HIGH_MEMORY_GIB_PER_VCPU = 8;

export const MINIMUM_RELIABILITY_FOR_RANKING = BasisPoints.of(5_000);

// A price hint spans the middle of similar listings, the 10th to the 90th
// percentile, so a few outliers do not stretch it.
export const PRICE_HINT_PERCENTILES = { LOW: 0.1, HIGH: 0.9 } as const;

// Shares of a month a whole machine is assumed rented out when estimating a
// host's earnings at its own price.
export const PRICE_HINT_UTILIZATIONS = [
	BasisPoints.of(3_000),
	BasisPoints.of(5_000),
] as const;
