/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { BasisPoints } from '../../../common/values/basis-points.value';
import type { MicroUsd } from '../../../common/values/micro-usd.value';
import type { MachinePriceCard } from '../entities/machine-price-card.entity';

export type PriceCardRates = Pick<
	MachinePriceCard,
	| 'vcpuHourMicroUsd'
	| 'memoryGibHourMicroUsd'
	| 'gpuHourMicroUsd'
	| 'diskGibMonthMicroUsd'
	| 'stoppedDiskGibMonthMicroUsd'
	| 'egressMicroUsdPerGiB'
>;

export interface PriceTerms {
	vcpuHourMicroUsd: bigint;
	memoryGibHourMicroUsd: bigint;
	gpuHourMicroUsd: bigint;
	diskGibMonthMicroUsd: bigint;
	stoppedDiskGibMonthMicroUsd: bigint;
	egressMicroUsdPerGiB: bigint;
	markupBasisPoints: BasisPoints;
}

export interface UsageQuantities {
	vcpuMillis: bigint;
	memoryGibMillis: bigint;
	gpuMillis: bigint;
	runningDiskGibMillis: bigint;
	stoppedDiskGibMillis: bigint;
}

export interface LinePrice {
	hostMicroUsd: MicroUsd;
	markupMicroUsd: MicroUsd;
	grossMicroUsd: MicroUsd;
}
