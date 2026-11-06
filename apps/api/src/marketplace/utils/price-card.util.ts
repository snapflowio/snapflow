/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MicroUsd } from '../../common/values/micro-usd.value';
import { MARKETPLACE_INITIAL_VERSION } from '../constants/marketplace.constants';
import type { MachineCategory } from '../enums/machine-category.enum';
import { MarketplaceErrorCode } from '../enums/marketplace-error-code.enum';
import type { PriceCardRates } from '../types/pricing.types';
import { priceTerms, referencePrice } from './pricing.util';

// Hosts are quoted their own price, without the customer's markup.
export const HOST_MARKUP_BASIS_POINTS = 0;

export interface PriceCardFacts {
	category: MachineCategory;
	gpuCount: number;
	floorMicroUsd: MicroUsd;
	egressCeilingMicroUsdPerGiB: MicroUsd;
}

export interface PriceCardEvaluation {
	referencePriceMicroUsd: MicroUsd;
	error:
		| MarketplaceErrorCode.GPU_RATE_REQUIRED
		| MarketplaceErrorCode.PRICE_BELOW_FLOOR
		| MarketplaceErrorCode.PRICE_ABOVE_CEILING
		| null;
}

export function nextPriceCardVersion(latestVersion: number | null): number {
	return latestVersion === null
		? MARKETPLACE_INITIAL_VERSION
		: latestVersion + 1;
}

export function priceCardReferencePrice(
	rates: PriceCardRates,
	category: MachineCategory
): MicroUsd {
	return referencePrice(priceTerms(rates, HOST_MARKUP_BASIS_POINTS), category);
}

export function evaluatePriceCard(
	rates: PriceCardRates,
	facts: PriceCardFacts
): PriceCardEvaluation {
	const referencePriceMicroUsd = priceCardReferencePrice(rates, facts.category);
	if (
		facts.gpuCount > 0 &&
		!MicroUsd.parse(rates.gpuHourMicroUsd).isPositive()
	) {
		return {
			referencePriceMicroUsd,
			error: MarketplaceErrorCode.GPU_RATE_REQUIRED,
		};
	}
	if (referencePriceMicroUsd.lessThan(facts.floorMicroUsd)) {
		return {
			referencePriceMicroUsd,
			error: MarketplaceErrorCode.PRICE_BELOW_FLOOR,
		};
	}
	if (
		MicroUsd.parse(rates.egressMicroUsdPerGiB).greaterThan(
			facts.egressCeilingMicroUsdPerGiB
		)
	) {
		return {
			referencePriceMicroUsd,
			error: MarketplaceErrorCode.PRICE_ABOVE_CEILING,
		};
	}
	return { referencePriceMicroUsd, error: null };
}
