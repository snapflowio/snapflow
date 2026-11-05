/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode, RequestContext } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { LogExecution } from '../../common/decorators/log-execution.decorator';
import { TrackJobExecution } from '../../common/decorators/track-job-execution.decorator';
import { TrackedJobs } from '../../common/utils/concurrency/tracked-jobs.util';
import { MicroUsd } from '../../common/values/micro-usd.value';
import {
	databaseNow,
	parseDatabaseTimestamp,
} from '../../infra/database/utils/database-time.util';
import { SettingsService } from '../../settings/services/settings.service';
import { MARKETPLACE_JOB } from '../constants/marketplace.constants';
import { REFERENCE_SHAPES } from '../constants/pricing.constants';
import {
	MarketReferencePriceDto,
	type UpdateMarketReferencePriceDto,
} from '../dto/market-reference-price.dto';
import type { PriceFloorDto } from '../dto/price-floor.dto';
import { MachineListing } from '../entities/machine-listing.entity';
import { MachinePriceCard } from '../entities/machine-price-card.entity';
import { MarketReferencePrice } from '../entities/market-reference-price.entity';
import { MarketplaceErrorCode } from '../enums/marketplace-error-code.enum';
import {
	marketSampleMachines,
	type PricedMachineRow,
	pricedMachinesForUpdate,
} from '../queries/market-reference-price.query';
import type { EffectiveFloor } from '../types/machine.types';
import { priceCardReferencePrice } from '../utils/price-card.util';
import {
	PRICE_CLASSES,
	priceClassCategory,
	requirePriceClass,
} from '../utils/price-class.util';
import {
	effectiveFloor,
	type FloorPolicy,
	marketMedians,
	nextBelowFloorSince,
} from '../utils/price-floor.util';
import { EgressCeilingService } from './egress-ceiling.service';
import { MachineMarketplaceService } from './machine-marketplace.service';

@Injectable()
export class PriceFloorService extends TrackedJobs {
	protected readonly logger = new Logger(PriceFloorService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly settings: SettingsService,
		private readonly machines: MachineMarketplaceService,
		private readonly egressCeilings: EgressCeilingService
	) {
		super();
	}

	async effectiveFloor(
		priceClass: string,
		manager: EntityManager = this.entityManager
	): Promise<EffectiveFloor> {
		const [reference, policy] = await Promise.all([
			manager.findOne(MarketReferencePrice, { priceClass }),
			this.policy(),
		]);
		const floor = reference ? effectiveFloor(reference, policy) : null;
		if (!floor) {
			throw new ConflictException({
				code: MarketplaceErrorCode.MARKET_REFERENCE_MISSING,
				message: 'No market reference price is set for this price class',
				priceClass,
			});
		}
		return floor;
	}

	async machineFloor(
		organizationId: string,
		machineId: string
	): Promise<PriceFloorDto> {
		const machine = await this.machines.findOwned(
			this.entityManager,
			organizationId,
			machineId
		);
		const { priceClass, category } = requirePriceClass(machine);
		const [floor, listing, ceiling] = await Promise.all([
			this.effectiveFloor(priceClass),
			this.entityManager.findOneOrFail(MachineListing, { machineId }),
			this.egressCeilings.current(),
		]);
		const card = listing.currentPriceCardId
			? await this.entityManager.findOneOrFail(MachinePriceCard, {
					id: listing.currentPriceCardId,
				})
			: null;
		const current = card ? priceCardReferencePrice(card, category) : null;
		return {
			priceClass,
			referenceShape: { ...REFERENCE_SHAPES[category] },
			medianMicroUsd: floor.medianMicroUsd.toString(),
			floorMicroUsd: floor.floorMicroUsd.toString(),
			sampleCount: floor.sampleCount,
			source: floor.source,
			currentReferencePriceMicroUsd: current?.toString() ?? null,
			belowFloor: current?.lessThan(floor.floorMicroUsd) ?? false,
			egressCeilingMicroUsdPerGiB: ceiling.ceilingMicroUsdPerGiB.toString(),
			egressMedianMicroUsdPerGiB:
				ceiling.medianMicroUsdPerGiB?.toString() ?? null,
			egressSampleCount: ceiling.sampleCount,
			egressCeilingSource: ceiling.source,
			aboveEgressCeiling: card
				? MicroUsd.parse(card.egressMicroUsdPerGiB).greaterThan(
						ceiling.ceilingMicroUsdPerGiB
					)
				: false,
		};
	}

	async listReferencePrices(): Promise<MarketReferencePriceDto[]> {
		const [stored, policy] = await Promise.all([
			this.entityManager.find(MarketReferencePrice, {}),
			this.policy(),
		]);
		const byClass = new Map(
			stored.map((reference) => [reference.priceClass, reference])
		);
		return PRICE_CLASSES.map((priceClass) => {
			const reference = byClass.get(priceClass) ?? {
				priceClass,
				bootstrapMedianMicroUsd: null,
				marketMedianMicroUsd: null,
				sampleCount: 0,
				computedAt: null,
			};
			return MarketReferencePriceDto.from(
				reference,
				effectiveFloor(reference, policy)
			);
		});
	}

	async updateBootstrapMedian(
		priceClass: string,
		input: UpdateMarketReferencePriceDto,
		userId: string
	): Promise<MarketReferencePriceDto> {
		if (priceClassCategory(priceClass) === null) {
			throw new NotFoundException({
				code: MarketplaceErrorCode.PRICE_CLASS_INVALID,
				message: 'Unknown price class',
			});
		}
		const reference = await this.entityManager.transactional(
			async (manager) => {
				await manager.upsert(
					MarketReferencePrice,
					{ priceClass },
					{ onConflictFields: ['priceClass'], onConflictAction: 'ignore' }
				);
				const locked = await manager.findOneOrFail(
					MarketReferencePrice,
					{ priceClass },
					{ lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true }
				);
				locked.bootstrapMedianMicroUsd = input.bootstrapMedianMicroUsd;
				locked.updatedBy = userId;
				return locked;
			}
		);
		return MarketReferencePriceDto.from(
			reference,
			effectiveFloor(reference, await this.policy())
		);
	}

	@TrackJobExecution()
	@LogExecution(MARKETPLACE_JOB.COMPUTE_MARKET_REFERENCE_PRICES)
	async computeMarketReferencePrices(): Promise<void> {
		await RequestContext.create(this.entityManager, () =>
			this.entityManager.transactional((manager) => this.recompute(manager))
		);
	}

	private async recompute(manager: EntityManager): Promise<void> {
		const [now, policy, samples, stored] = await Promise.all([
			databaseNow(manager),
			this.policy(),
			marketSampleMachines(manager),
			manager.find(MarketReferencePrice, {}),
		]);
		const medians = marketMedians(
			samples.map((row) => ({
				priceClass: requirePriceClass(row).priceClass,
				organizationId: row.organizationId,
				referencePriceMicroUsd: priceCardReferencePrice(row, row.category),
			}))
		);
		const byClass = new Map(
			stored.map((reference) => [reference.priceClass, reference])
		);
		const floors = new Map<string, EffectiveFloor | null>();
		for (const priceClass of PRICE_CLASSES) {
			const reference =
				byClass.get(priceClass) ?? this.emptyReference(priceClass);
			const market = medians.get(priceClass);
			reference.marketMedianMicroUsd =
				market?.medianMicroUsd.toString() ?? null;
			reference.sampleCount = market?.sampleCount ?? 0;
			reference.computedAt = now;
			manager.persist(reference);
			floors.set(priceClass, effectiveFloor(reference, policy));
		}
		const ceiling = await this.egressCeilings.recompute(manager, samples, now);
		await manager.flush();
		const priced = await pricedMachinesForUpdate(manager);
		await this.flagBelowFloor(manager, priced, floors, now);
		await this.egressCeilings.flagAboveCeiling(manager, priced, ceiling, now);
		this.logger.log(
			`Computed market reference prices from ${samples.length} machines`
		);
	}

	private async flagBelowFloor(
		manager: EntityManager,
		priced: readonly PricedMachineRow[],
		floors: ReadonlyMap<string, EffectiveFloor | null>,
		now: Date
	): Promise<void> {
		const flagged: string[] = [];
		const cleared: string[] = [];
		for (const row of priced) {
			const current = row.belowFloorSince
				? parseDatabaseTimestamp(row.belowFloorSince)
				: null;
			const next = nextBelowFloorSince(
				priceCardReferencePrice(row, row.category),
				floors.get(requirePriceClass(row).priceClass) ?? null,
				current,
				now
			);
			if (current === null && next !== null) flagged.push(row.machineId);
			if (current !== null && next === null) cleared.push(row.machineId);
		}
		if (flagged.length > 0) {
			await manager.nativeUpdate(
				MachineListing,
				{ machineId: { $in: flagged } },
				{ belowFloorSince: now }
			);
		}
		if (cleared.length > 0) {
			await manager.nativeUpdate(
				MachineListing,
				{ machineId: { $in: cleared } },
				{ belowFloorSince: null }
			);
		}
	}

	private emptyReference(priceClass: string): MarketReferencePrice {
		const reference = new MarketReferencePrice();
		reference.priceClass = priceClass;
		return reference;
	}

	private async policy(): Promise<FloorPolicy> {
		const settings = await this.settings.get();
		return {
			floorBasisPoints: settings.priceFloorBasisPoints,
			minimumSamples: settings.priceFloorMinimumSamples,
		};
	}
}
