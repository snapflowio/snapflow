/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { MicroUsd } from '../../common/values/micro-usd.value';
import {
	ResourceShape,
	type ResourceShapeFields,
} from '../../common/values/resource-shape.value';
import type { PlacementPrice } from '../../marketplace/entities/placement-price.entity';
import type {
	PriceCardTerms,
	PriceTerms,
} from '../../marketplace/types/pricing.types';
import {
	type MarkupSettings,
	marketMarkupBasisPoints,
} from '../../marketplace/utils/pricing/markup.util';
import {
	FREE_TERMS,
	interruptibleCard,
	priceTerms,
	runningHourlyPrice,
	wholeMachinePriceTerms,
} from '../../marketplace/utils/pricing/pricing.util';

type PricedColumns = Pick<
	PlacementPrice,
	| 'cpu'
	| 'memoryGib'
	| 'diskGib'
	| 'gpu'
	| 'markupBasisPoints'
	| 'wholeMachine'
	| 'interruptible'
>;

export type PlacementRental = Pick<
	PlacementPrice,
	'wholeMachine' | 'interruptible'
>;

export function placementPriceTerms(
	card: PriceCardTerms | null,
	shape: ResourceShapeFields,
	markupBasisPoints: number,
	rental: PlacementRental
): PriceTerms {
	if (!card) return FREE_TERMS;
	if (rental.wholeMachine) {
		return wholeMachinePriceTerms(card, markupBasisPoints);
	}
	return priceTerms(
		rental.interruptible ? interruptibleCard(card) : card,
		shape,
		markupBasisPoints
	);
}

export function priceShape(
	placementPrice: Pick<PlacementPrice, 'cpu' | 'memoryGib' | 'diskGib' | 'gpu'>
): ResourceShape {
	return ResourceShape.fromColumns(placementPrice);
}

export function recordedPriceTerms(
	placementPrice: PricedColumns,
	card: PriceCardTerms | null
): PriceTerms {
	return placementPriceTerms(
		card,
		priceShape(placementPrice),
		placementPrice.markupBasisPoints,
		placementPrice
	);
}

export function repricedHourlyGross(
	placementPrice: PricedColumns,
	card: PriceCardTerms,
	settings: MarkupSettings
): MicroUsd {
	const shape = priceShape(placementPrice);
	return runningHourlyPrice(
		placementPriceTerms(
			card,
			shape,
			marketMarkupBasisPoints(settings),
			placementPrice
		),
		shape
	).grossMicroUsd;
}
