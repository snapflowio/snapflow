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
import { findCursorPage } from '../../../common/utils/pagination/cursor-page.util';
import { Machine } from '../../../sandbox/machine/entities/machine.entity';
import type { BenchmarkState } from '../../../verification/qualification/enums/benchmark-state.enum';
import {
	HostMachineDto,
	type HostMachinePageDto,
} from '../dto/host-machine.dto';
import { PriceCardDto } from '../dto/price-card.dto';
import { MachineListing } from '../entities/machine-listing.entity';
import { MachinePriceCard } from '../entities/machine-price-card.entity';
import { MachineMarketplaceService } from './machine-marketplace.service';

interface LatestBenchmarkRow {
	machineId: string;
	state: BenchmarkState;
}

@Injectable()
export class HostMachineService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly marketplace: MachineMarketplaceService
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
		const [cards, benchmarks] = await Promise.all([
			cardIds.length > 0
				? this.entityManager.find(MachinePriceCard, { id: { $in: cardIds } })
				: Promise.resolve([]),
			this.entityManager.execute<LatestBenchmarkRow[]>(
				`SELECT DISTINCT ON ("machineId") "machineId", state
				FROM machine_benchmark
				WHERE "machineId" = ANY(ARRAY[?]::uuid[])
				ORDER BY "machineId", "issuedAt" DESC`,
				[machineIds]
			),
		]);
		const listingsById = new Map(
			listings.map((listing) => [listing.machineId, listing])
		);
		const cardsById = new Map(cards.map((card) => [card.id, card]));
		const benchmarksById = new Map(
			benchmarks.map((row) => [row.machineId, row.state])
		);
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
			});
		});
	}
}
