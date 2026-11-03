/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MicroUsd } from '../../../common/values/micro-usd.value';
import type { MarketReferencePrice } from '../entities/market-reference-price.entity';
import { PriceFloorSource } from '../enums/price-floor-source.enum';
import type { EffectiveFloor } from '../types/machine.types';
import { median, priceFloor } from './pricing.util';

export interface ReferenceSample {
	priceClass: string;
	organizationId: string;
	referencePriceMicroUsd: MicroUsd;
}

export interface MarketMedian {
	medianMicroUsd: MicroUsd;
	sampleCount: number;
}

export interface FloorPolicy {
	floorBasisPoints: number;
	minimumSamples: number;
}

export type ReferenceMedians = Pick<
	MarketReferencePrice,
	| 'priceClass'
	| 'bootstrapMedianMicroUsd'
	| 'marketMedianMicroUsd'
	| 'sampleCount'
>;

export function marketMedians(
	samples: readonly ReferenceSample[]
): Map<string, MarketMedian> {
	const byClass = new Map<string, Map<string, MicroUsd[]>>();
	for (const sample of samples) {
		const hosts =
			byClass.get(sample.priceClass) ?? new Map<string, MicroUsd[]>();
		const prices = hosts.get(sample.organizationId) ?? [];
		prices.push(sample.referencePriceMicroUsd);
		hosts.set(sample.organizationId, prices);
		byClass.set(sample.priceClass, hosts);
	}
	return new Map(
		[...byClass].map(([priceClass, hosts]) => {
			const hostMedians = [...hosts.values()].map(median);
			return [
				priceClass,
				{
					medianMicroUsd: median(hostMedians),
					sampleCount: hostMedians.length,
				},
			];
		})
	);
}

export function effectiveFloor(
	reference: ReferenceMedians,
	policy: FloorPolicy
): EffectiveFloor | null {
	const market =
		reference.marketMedianMicroUsd !== null &&
		reference.sampleCount >= policy.minimumSamples;
	const medianValue = market
		? reference.marketMedianMicroUsd
		: reference.bootstrapMedianMicroUsd;
	if (medianValue === null) return null;
	const medianMicroUsd = MicroUsd.parse(medianValue);
	return {
		priceClass: reference.priceClass,
		medianMicroUsd,
		floorMicroUsd: priceFloor(medianMicroUsd, policy.floorBasisPoints),
		sampleCount: reference.sampleCount,
		source: market ? PriceFloorSource.MARKET : PriceFloorSource.BOOTSTRAP,
	};
}

export function nextBelowFloorSince(
	referencePriceMicroUsd: MicroUsd,
	floor: EffectiveFloor | null,
	belowFloorSince: Date | null,
	now: Date
): Date | null {
	if (floor === null || referencePriceMicroUsd.atLeast(floor.floorMicroUsd)) {
		return null;
	}
	return belowFloorSince ?? now;
}
