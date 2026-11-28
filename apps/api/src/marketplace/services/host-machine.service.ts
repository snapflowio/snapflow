/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { QueryOrder } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { findCursorPage } from '../../common/utils/pagination/cursor-page.util';
import { Machine } from '../../machine/entities/machine.entity';
import {
	HostMachineDto,
	type HostMachinePageDto,
} from '../dto/host-machine.dto';
import type { MachineMarketDto } from '../dto/machine-market.dto';
import { PriceCardDto } from '../dto/price-card.dto';
import { MachineListing } from '../entities/machine-listing.entity';
import { MachinePriceCard } from '../entities/machine-price-card.entity';
import { latestBenchmarkStates } from '../queries/latest-benchmark-state.query';
import {
	machineUtilization,
	utilizationOf,
} from '../queries/machine-utilization.query';
import { MachineMarketService } from './machine-market.service';
import { MachineMarketplaceService } from './machine-marketplace.service';

@Injectable()
export class HostMachineService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly marketplace: MachineMarketplaceService,
		private readonly machineMarket: MachineMarketService
	) {}

	async list(
		organizationId: string,
		limit: number,
		cursor?: string
	): Promise<HostMachinePageDto> {
		const page = await findCursorPage(this.entityManager, Machine, {
			where: { organizationId },
			orderBy: { createdAt: QueryOrder.DESC, id: QueryOrder.DESC },
			limit,
			cursor,
		});
		return { ...page, items: await this.describe(page.items) };
	}

	async get(
		organizationId: string,
		machineId: string
	): Promise<HostMachineDto> {
		const machine = await this.marketplace.findOwned(
			this.entityManager,
			organizationId,
			machineId
		);
		const [described] = await this.describe([machine]);
		return described;
	}

	async market(
		organizationId: string,
		machineId: string
	): Promise<MachineMarketDto> {
		const machine = await this.marketplace.findOwned(
			this.entityManager,
			organizationId,
			machineId
		);
		return this.machineMarket.market(this.entityManager, machine);
	}

	private async describe(
		machines: readonly Machine[]
	): Promise<HostMachineDto[]> {
		const machineIds = machines.map((machine) => machine.id);
		if (machineIds.length === 0) return [];
		const listings = await this.entityManager.find(MachineListing, {
			machineId: { $in: machineIds },
		});
		const cardIds = listings.flatMap((listing) =>
			listing.currentPriceCardId ? [listing.currentPriceCardId] : []
		);
		const [cards, benchmarksById, utilizationById] = await Promise.all([
			cardIds.length > 0
				? this.entityManager.find(MachinePriceCard, { id: { $in: cardIds } })
				: Promise.resolve([]),
			latestBenchmarkStates(this.entityManager, machineIds),
			machineUtilization(this.entityManager, machineIds),
		]);
		const listingsById = new Map(
			listings.map((listing) => [listing.machineId, listing])
		);
		const cardsById = new Map(cards.map((card) => [card.id, card]));
		return machines.map((machine) => {
			const listing = listingsById.get(machine.id);
			if (!listing) {
				throw new Error(`Machine ${machine.id} has no listing`);
			}
			const card = listing.currentPriceCardId
				? cardsById.get(listing.currentPriceCardId)
				: undefined;
			return HostMachineDto.from({
				machine,
				listing,
				currentPriceCard: card ? PriceCardDto.from(card) : null,
				latestBenchmarkState: benchmarksById.get(machine.id) ?? null,
				utilization: utilizationOf(utilizationById, machine.id),
			});
		});
	}
}
