/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BASIS_POINTS_DENOMINATOR } from '../../../common/constants/money.constants';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import type { MarketReferencePrice } from '../entities/market-reference-price.entity';
import { EgressCeilingSource } from '../enums/egress-ceiling-source.enum';

export interface EgressCeilingPolicy {
	maximumMicroUsdPerGiB: MicroUsd;
	medianBasisPoints: number;
	minimumSamples: number;
}

export interface EgressCeiling {
	ceilingMicroUsdPerGiB: MicroUsd;
	medianMicroUsdPerGiB: MicroUsd | null;
	sampleCount: number;
	source: EgressCeilingSource;
}

export type EgressMarket = Pick<
	MarketReferencePrice,
	'marketMedianMicroUsd' | 'sampleCount'
>;

export function egressCeiling(
	market: EgressMarket | null,
	policy: EgressCeilingPolicy
): EgressCeiling {
	const median = MicroUsd.parseNullable(market?.marketMedianMicroUsd ?? null);
	const sampleCount = market?.sampleCount ?? 0;
	if (
		median === null ||
		!median.isPositive() ||
		sampleCount < policy.minimumSamples
	) {
		return {
			ceilingMicroUsdPerGiB: policy.maximumMicroUsdPerGiB,
			medianMicroUsdPerGiB: median,
			sampleCount,
			source: EgressCeilingSource.SETTINGS,
		};
	}
	const marketCeiling = median
		.multiply(BigInt(policy.medianBasisPoints))
		.divideCeil(BASIS_POINTS_DENOMINATOR);
	return {
		ceilingMicroUsdPerGiB: marketCeiling.min(policy.maximumMicroUsdPerGiB),
		medianMicroUsdPerGiB: median,
		sampleCount,
		source: marketCeiling.lessThan(policy.maximumMicroUsdPerGiB)
			? EgressCeilingSource.MARKET
			: EgressCeilingSource.SETTINGS,
	};
}

export function nextAboveEgressCeilingSince(
	egressMicroUsdPerGiB: MicroUsd,
	ceiling: EgressCeiling,
	aboveSince: Date | null,
	now: Date
): Date | null {
	if (egressMicroUsdPerGiB.atMost(ceiling.ceilingMicroUsdPerGiB)) return null;
	return aboveSince ?? now;
}
