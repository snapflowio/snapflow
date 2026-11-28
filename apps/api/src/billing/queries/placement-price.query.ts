/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { MachinePriceCard } from '../../marketplace/entities/machine-price-card.entity';
import { PlacementPrice } from '../../marketplace/entities/placement-price.entity';
import type { PriceTerms } from '../../marketplace/types/pricing.types';
import { recordedPriceTerms } from '../utils/placement-pricing.util';

export interface PricedPlacement {
	placementPrice: PlacementPrice;
	terms: PriceTerms;
}

export async function storedPriceTerms(
	manager: EntityManager,
	placementPrice: PlacementPrice
): Promise<PriceTerms> {
	const card = placementPrice.priceCardId
		? await manager.findOneOrFail(MachinePriceCard, {
				id: placementPrice.priceCardId,
			})
		: null;
	return recordedPriceTerms(placementPrice, card);
}

export async function pricedPlacement(
	manager: EntityManager,
	placementPriceId: string
): Promise<PricedPlacement> {
	const placementPrice = await manager.findOneOrFail(PlacementPrice, {
		id: placementPriceId,
	});
	return {
		placementPrice,
		terms: await storedPriceTerms(manager, placementPrice),
	};
}

export async function pricedPlacements(
	manager: EntityManager,
	placementPriceIds: readonly string[]
): Promise<Map<string, PriceTerms>> {
	const placementPrices = await manager.find(PlacementPrice, {
		id: { $in: [...new Set(placementPriceIds)] },
	});
	const cardIds = placementPrices.flatMap(({ priceCardId }) =>
		priceCardId ? [priceCardId] : []
	);
	const cards = new Map(
		(cardIds.length === 0
			? []
			: await manager.find(MachinePriceCard, { id: { $in: cardIds } })
		).map((card) => [card.id, card])
	);
	return new Map(
		placementPrices.map((placementPrice) => [
			placementPrice.id,
			recordedPriceTerms(placementPrice, priceCard(placementPrice, cards)),
		])
	);
}

function priceCard(
	placementPrice: PlacementPrice,
	cards: ReadonlyMap<string, MachinePriceCard>
): MachinePriceCard | null {
	if (!placementPrice.priceCardId) return null;
	const card = cards.get(placementPrice.priceCardId);
	if (!card) {
		throw new Error(
			`Placement price ${placementPrice.id} references missing price card ${placementPrice.priceCardId}`
		);
	}
	return card;
}
