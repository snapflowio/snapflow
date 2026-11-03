/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { MachinePriceCard } from '../../../marketplace/machine/entities/machine-price-card.entity';
import { SandboxLease } from '../../../marketplace/machine/entities/sandbox-lease.entity';
import type { PriceTerms } from '../../../marketplace/machine/types/pricing.types';
import { placementPriceTerms } from '../utils/lease-pricing.util';

export interface PricedLease {
	lease: SandboxLease;
	terms: PriceTerms;
}

export async function leasePriceTerms(
	manager: EntityManager,
	lease: SandboxLease
): Promise<PriceTerms> {
	const card = lease.priceCardId
		? await manager.findOneOrFail(MachinePriceCard, { id: lease.priceCardId })
		: null;
	return placementPriceTerms(card, lease.markupBasisPoints);
}

export async function pricedLease(
	manager: EntityManager,
	leaseId: string
): Promise<PricedLease> {
	const lease = await manager.findOneOrFail(SandboxLease, { id: leaseId });
	return { lease, terms: await leasePriceTerms(manager, lease) };
}

export async function pricedLeases(
	manager: EntityManager,
	leaseIds: readonly string[]
): Promise<Map<string, PriceTerms>> {
	const leases = await manager.find(SandboxLease, {
		id: { $in: [...new Set(leaseIds)] },
	});
	const cardIds = leases.flatMap(({ priceCardId }) =>
		priceCardId ? [priceCardId] : []
	);
	const cards = new Map(
		(cardIds.length === 0
			? []
			: await manager.find(MachinePriceCard, { id: { $in: cardIds } })
		).map((card) => [card.id, card])
	);
	return new Map(
		leases.map((lease) => [
			lease.id,
			placementPriceTerms(leaseCard(lease, cards), lease.markupBasisPoints),
		])
	);
}

function leaseCard(
	lease: SandboxLease,
	cards: ReadonlyMap<string, MachinePriceCard>
): MachinePriceCard | null {
	if (!lease.priceCardId) return null;
	const card = cards.get(lease.priceCardId);
	if (!card) {
		throw new Error(
			`Lease ${lease.id} references missing price card ${lease.priceCardId}`
		);
	}
	return card;
}
