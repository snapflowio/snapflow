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
import { BadRequestException, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { v4 } from 'uuid';
import { findCursorPage } from '../../common/utils/pagination/cursor-page.util';
import { Machine } from '../../machine/entities/machine.entity';
import { VerificationEvents } from '../../verification/constants/verification-events.constants';
import { BenchmarkPassedEvent } from '../../verification/events/benchmark-passed.event';
import { INTERRUPTIBLE_PRICE } from '../constants/pricing.constants';
import {
	type CreatePriceCardDto,
	PriceCardDto,
	type PriceCardPageDto,
} from '../dto/price-card.dto';
import { MachineListing } from '../entities/machine-listing.entity';
import { MachinePriceCard } from '../entities/machine-price-card.entity';
import { MarketplaceErrorCode } from '../enums/marketplace-error-code.enum';
import {
	nextPriceCardVersion,
	pricedCapacity,
	sameCapacity,
} from '../utils/pricing/price-card.util';
import { MachineMarketplaceService } from './machine-marketplace.service';

const NO_GPU_RATE = '0';

function gpuRate(machine: Pick<Machine, 'gpuCount'>, rate?: string): string {
	const hasGpus = machine.gpuCount > 0;
	if (hasGpus !== (rate !== undefined)) {
		throw new BadRequestException({
			code: MarketplaceErrorCode.GPU_RATE_MISMATCH,
			message: hasGpus
				? 'Set a GPU rate for a machine with GPUs'
				: 'A machine without GPUs takes no GPU rate',
		});
	}
	return rate ?? NO_GPU_RATE;
}

@Injectable()
export class PriceCardService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly machines: MachineMarketplaceService
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
		const listing = await manager.findOneOrFail(
			MachineListing,
			{ machineId },
			{ lockMode: LockMode.PESSIMISTIC_WRITE }
		);
		const latest = await this.latest(manager, machineId);
		return this.publish(manager, machine, listing, {
			organizationId,
			version: nextPriceCardVersion(latest?.version ?? null),
			vcpuHourMicroUsd: input.vcpuHourMicroUsd,
			memoryGibHourMicroUsd: input.memoryGibHourMicroUsd,
			gpuHourMicroUsd: gpuRate(machine, input.gpuHourMicroUsd),
			diskGibMonthMicroUsd: input.diskGibMonthMicroUsd,
			interruptibleBasisPoints:
				input.interruptibleBasisPoints ??
				latest?.interruptibleBasisPoints ??
				INTERRUPTIBLE_PRICE.DEFAULT_BASIS_POINTS,
			createdBy: userId,
		});
	}

	@OnEvent(VerificationEvents.BENCHMARK_PASSED)
	async onBenchmarkPassed({ machineId }: BenchmarkPassedEvent): Promise<void> {
		await this.entityManager.fork().transactional(async (manager) => {
			const listing = await manager.findOne(
				MachineListing,
				{ machineId },
				{ lockMode: LockMode.PESSIMISTIC_WRITE }
			);
			if (!listing?.currentPriceCardId) return;
			const machine = await manager.findOneOrFail(Machine, { id: machineId });
			const current = await manager.findOneOrFail(MachinePriceCard, {
				id: listing.currentPriceCardId,
			});
			if (sameCapacity(current, pricedCapacity(machine))) return;
			const latest = await this.latest(manager, machineId);
			await this.publish(manager, machine, listing, {
				organizationId: current.organizationId,
				version: nextPriceCardVersion(latest?.version ?? null),
				vcpuHourMicroUsd: current.vcpuHourMicroUsd,
				memoryGibHourMicroUsd: current.memoryGibHourMicroUsd,
				gpuHourMicroUsd: current.gpuHourMicroUsd,
				diskGibMonthMicroUsd: current.diskGibMonthMicroUsd,
				interruptibleBasisPoints: current.interruptibleBasisPoints,
				createdBy: null,
			});
		});
	}

	private latest(
		manager: EntityManager,
		machineId: string
	): Promise<MachinePriceCard | null> {
		return manager.findOne(
			MachinePriceCard,
			{ machineId },
			{ orderBy: { version: QueryOrder.DESC } }
		);
	}

	private async publish(
		manager: EntityManager,
		machine: Machine,
		listing: MachineListing,
		terms: Omit<
			MachinePriceCard,
			'id' | 'machineId' | 'vcpu' | 'memoryGib' | 'gpuCount' | 'createdAt'
		>
	): Promise<MachinePriceCard> {
		const card = Object.assign(new MachinePriceCard(), {
			id: v4(),
			machineId: machine.id,
			...terms,
			...pricedCapacity(machine),
		});
		manager.persist(card);
		listing.currentPriceCardId = card.id;
		await manager.flush();
		return card;
	}
}
