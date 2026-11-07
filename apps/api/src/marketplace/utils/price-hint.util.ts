/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { RoundingMode } from '../../common/constants/money.constants';
import { MILLISECONDS_PER_HOUR } from '../../common/constants/time.constants';
import type { BasisPoints } from '../../common/values/basis-points.value';
import { MicroUsd } from '../../common/values/micro-usd.value';
import type { ResourceShapeFields } from '../../common/values/resource-shape.value';
import {
	HOURS_PER_BILLING_MONTH,
	PRICE_HINT_UTILIZATIONS,
} from '../constants/pricing.constants';
import { PricedResource } from '../enums/priced-resource.enum';
import type { SimilarListingPrices } from '../queries/price-hint.query';
import type { PriceCardRates } from '../types/pricing.types';
import { HOST_MARKUP_BASIS_POINTS } from './price-card.util';
import { priceTerms, priceUsage, usageQuantities } from './pricing.util';

const BILLING_MONTH_MILLIS =
	BigInt(MILLISECONDS_PER_HOUR) * HOURS_PER_BILLING_MONTH;
const NO_STOPPED_MILLIS = 0n;

export interface PriceRange {
	resource: PricedResource;
	lowMicroUsd: MicroUsd;
	highMicroUsd: MicroUsd;
}

export interface EarningsEstimate {
	utilization: BasisPoints;
	monthlyMicroUsd: MicroUsd;
}

// The low to high range of every resource a machine is priced by; the GPU
// rate only for a machine with GPUs. Empty when no similar listing exists.
export function similarPriceRanges(
	prices: SimilarListingPrices,
	gpuCount: number
): PriceRange[] {
	return Object.values(PricedResource).flatMap((resource) => {
		if (resource === PricedResource.GPU_HOUR && gpuCount === 0) return [];
		const low = prices[`${resource}_low`];
		const high = prices[`${resource}_high`];
		if (low === null || high === null) return [];
		return [
			{
				resource,
				lowMicroUsd: MicroUsd.parse(low),
				highMicroUsd: MicroUsd.parse(high),
			},
		];
	});
}

// What the host earns in a month renting out the whole machine (its
// measured vCPUs, memory, disk and GPUs) at its own price for each assumed
// share of the month. Hosts keep their whole price; the markup is on top.
export function monthlyEarningsEstimates(
	rates: PriceCardRates,
	machineShape: ResourceShapeFields
): EarningsEstimate[] {
	const fullMonth = priceUsage(
		priceTerms(rates, HOST_MARKUP_BASIS_POINTS),
		usageQuantities(machineShape, BILLING_MONTH_MILLIS, NO_STOPPED_MILLIS)
	).hostMicroUsd;
	return PRICE_HINT_UTILIZATIONS.map((utilization) => ({
		utilization,
		monthlyMicroUsd: utilization.applyTo(fullMonth, RoundingMode.FLOOR),
	}));
}
