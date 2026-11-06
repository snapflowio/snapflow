/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import type { ResourceShapeFields } from '../../common/values/resource-shape.value';
import type { Machine } from '../../machine/entities/machine.entity';
import {
	EarningsEstimateDto,
	type MachinePriceHintDto,
	PriceRangeDto,
} from '../dto/price-hint.dto';
import { MachineListing } from '../entities/machine-listing.entity';
import { MachinePriceCard } from '../entities/machine-price-card.entity';
import { similarListingPrices } from '../queries/price-hint.query';
import { requirePriceClass } from '../utils/price-class.util';
import {
	monthlyEarningsEstimates,
	similarPriceRanges,
} from '../utils/price-hint.util';
import { MachineMarketplaceService } from './machine-marketplace.service';

// What similar machines list for and what the host's own price would earn,
// for the host's pricing page.
@Injectable()
export class PriceHintService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly machines: MachineMarketplaceService
	) {}

	async machineHint(
		organizationId: string,
		machineId: string
	): Promise<MachinePriceHintDto> {
		const manager = this.entityManager.fork();
		const machine = await this.machines.findOwned(
			manager,
			organizationId,
			machineId
		);
		const { priceClass, category } = requirePriceClass(machine);
		const similar = await similarListingPrices(manager, {
			id: machine.id,
			category,
			gpuType: machine.gpuType,
		});
		const listing = await manager.findOneOrFail(MachineListing, { machineId });
		const card = listing.currentPriceCardId
			? await manager.findOneOrFail(MachinePriceCard, {
					id: listing.currentPriceCardId,
				})
			: null;
		return {
			priceClass,
			similarListingCount: similar.listings,
			ranges: similarPriceRanges(similar, machine.gpuCount).map(
				PriceRangeDto.from
			),
			earnings: card
				? monthlyEarningsEstimates(card, measuredShape(machine)).map(
						EarningsEstimateDto.from
					)
				: [],
		};
	}
}

// A machine with a price class has passed a benchmark, which measured it.
function measuredShape(machine: Machine): ResourceShapeFields {
	const { measuredVcpu, measuredMemoryGib, measuredDiskGib, gpuCount } =
		machine;
	if (
		measuredVcpu === null ||
		measuredMemoryGib === null ||
		measuredDiskGib === null
	) {
		throw new Error(
			`Machine ${machine.id} has a price class but no measurements`
		);
	}
	return {
		cpu: measuredVcpu,
		memoryGiB: measuredMemoryGib,
		diskGiB: measuredDiskGib,
		gpu: gpuCount,
	};
}
