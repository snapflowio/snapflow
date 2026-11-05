/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode, QueryOrder } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { v4 } from 'uuid';
import { findCursorPage } from '../../common/utils/pagination/cursor-page.util';
import { MicroUsd } from '../../common/values/micro-usd.value';
import {
	type CreatePriceCardDto,
	PriceCardDto,
	type PriceCardPageDto,
} from '../dto/price-card.dto';
import { MachineListing } from '../entities/machine-listing.entity';
import { MachinePriceCard } from '../entities/machine-price-card.entity';
import { MarketplaceErrorCode } from '../enums/marketplace-error-code.enum';
import { PriceAboveCeilingException } from '../exceptions/price-above-ceiling.exception';
import { PriceBelowFloorException } from '../exceptions/price-below-floor.exception';
import {
	evaluatePriceCard,
	nextPriceCardVersion,
} from '../utils/price-card.util';
import { requirePriceClass } from '../utils/price-class.util';
import { EgressCeilingService } from './egress-ceiling.service';
import { MachineMarketplaceService } from './machine-marketplace.service';
import { PriceFloorService } from './price-floor.service';

@Injectable()
export class PriceCardService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly machines: MachineMarketplaceService,
		private readonly floors: PriceFloorService,
		private readonly egressCeilings: EgressCeilingService
	) {}

	async list(
		organizationId: string,
		machineId: string,
		limit: number,
		cursor?: string
	): Promise<PriceCardPageDto> {
		await this.machines.findOwned(
			this.entityManager,
			organizationId,
			machineId
		);
		const page = await findCursorPage(this.entityManager, MachinePriceCard, {
			where: { machineId, organizationId },
			orderBy: { version: QueryOrder.DESC },
			limit,
			cursor,
		});
		return { ...page, items: page.items.map(PriceCardDto.from) };
	}

	async create(
		manager: EntityManager,
		organizationId: string,
		machineId: string,
		input: CreatePriceCardDto,
		userId: string
	): Promise<MachinePriceCard> {
		const machine = await this.machines.findOwned(
			manager,
			organizationId,
			machineId
		);
		const { priceClass, category } = requirePriceClass(machine);
		const [floor, ceiling] = await Promise.all([
			this.floors.effectiveFloor(priceClass, manager),
			this.egressCeilings.current(manager),
		]);
		const evaluation = evaluatePriceCard(input, {
			category,
			gpuCount: machine.gpuCount,
			floorMicroUsd: floor.floorMicroUsd,
			egressCeilingMicroUsdPerGiB: ceiling.ceilingMicroUsdPerGiB,
		});
		if (evaluation.error === MarketplaceErrorCode.PRICE_BELOW_FLOOR) {
			throw new PriceBelowFloorException(
				floor.floorMicroUsd,
				evaluation.referencePriceMicroUsd
			);
		}
		if (evaluation.error === MarketplaceErrorCode.PRICE_ABOVE_CEILING) {
			throw new PriceAboveCeilingException(
				ceiling.ceilingMicroUsdPerGiB,
				MicroUsd.parse(input.egressMicroUsdPerGiB)
			);
		}
		if (evaluation.error === MarketplaceErrorCode.GPU_RATE_REQUIRED) {
			throw new UnprocessableEntityException({
				code: evaluation.error,
				message: 'GPU machines need a positive GPU rate',
			});
		}
		const listing = await manager.findOneOrFail(
			MachineListing,
			{ machineId },
			{ lockMode: LockMode.PESSIMISTIC_WRITE }
		);
		const latest = await manager.findOne(
			MachinePriceCard,
			{ machineId },
			{ orderBy: { version: QueryOrder.DESC } }
		);
		const card = new MachinePriceCard();
		card.id = v4();
		card.machineId = machineId;
		card.organizationId = organizationId;
		card.version = nextPriceCardVersion(latest?.version ?? null);
		card.vcpuHourMicroUsd = input.vcpuHourMicroUsd;
		card.memoryGibHourMicroUsd = input.memoryGibHourMicroUsd;
		card.gpuHourMicroUsd = input.gpuHourMicroUsd;
		card.diskGibMonthMicroUsd = input.diskGibMonthMicroUsd;
		card.stoppedDiskGibMonthMicroUsd = input.stoppedDiskGibMonthMicroUsd;
		card.egressMicroUsdPerGiB = input.egressMicroUsdPerGiB;
		card.egressCeilingMicroUsdPerGiB = ceiling.ceilingMicroUsdPerGiB.toString();
		card.referencePriceMicroUsd = evaluation.referencePriceMicroUsd.toString();
		card.floorMicroUsd = floor.floorMicroUsd.toString();
		card.createdBy = userId;
		manager.persist(card);
		listing.currentPriceCardId = card.id;
		listing.belowFloorSince = null;
		listing.aboveEgressCeilingSince = null;
		await manager.flush();
		return card;
	}
}
