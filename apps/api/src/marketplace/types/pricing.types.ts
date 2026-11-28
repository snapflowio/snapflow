/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { BasisPoints } from '../../common/values/basis-points.value';
import type { MicroUsd } from '../../common/values/micro-usd.value';
import type { MachinePriceCard } from '../entities/machine-price-card.entity';

export type ComputeRates = Pick<
	MachinePriceCard,
	'vcpuHourMicroUsd' | 'memoryGibHourMicroUsd' | 'gpuHourMicroUsd'
>;

export type HostRates = ComputeRates &
	Pick<MachinePriceCard, 'diskGibMonthMicroUsd'>;

export type PricedCapacity = Pick<
	MachinePriceCard,
	'vcpu' | 'memoryGib' | 'gpuCount'
>;

export type PriceCardTerms = HostRates &
	PricedCapacity &
	Pick<MachinePriceCard, 'interruptibleBasisPoints'>;

export interface PriceTerms {
	hourMicroUsd: bigint;
	diskGibMonthMicroUsd: bigint;
	markupBasisPoints: BasisPoints;
}

export interface UsageQuantities {
	runningMillis: bigint;
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
