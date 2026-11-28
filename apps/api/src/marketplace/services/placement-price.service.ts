/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode } from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/postgresql';
import {
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { v4 } from 'uuid';
import {
	recordedPriceTerms,
	repricedHourlyGross,
} from '../../billing/utils/placement-pricing.util';
import type { MicroUsd } from '../../common/values/micro-usd.value';
import { ResourceShape } from '../../common/values/resource-shape.value';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { SettingsService } from '../../settings/services/settings.service';
import { PaymentChannelService } from '../../settlement/services/channels/payment-channel.service';
import { SandboxPriceDto } from '../dto/sandbox-price.dto';
import { MachineListing } from '../entities/machine-listing.entity';
import { MachinePriceCard } from '../entities/machine-price-card.entity';
import { PlacementPrice } from '../entities/placement-price.entity';
import { MarketplaceErrorCode } from '../enums/marketplace-error-code.enum';
import { PriceEndReason } from '../enums/price-end-reason.enum';
import { PriceTermsUnavailableError } from '../exceptions/price-terms-unavailable.exception';
import type { OpenPlacementPriceInput } from '../types/machine.types';
import {
	openingPriceTerms,
	type PriceParties,
	type PriceTermsResult,
	repricedPriceTerms,
} from '../utils/placement-price.util';
import { marketMarkupBasisPoints } from '../utils/pricing/markup.util';
import {
	runningHourlyPrice,
	stoppedHourlyPrice,
} from '../utils/pricing/pricing.util';

type PriceTemplate = Pick<
	PlacementPrice,
	| 'sandboxId'
	| 'placementId'
	| 'customerOrganizationId'
	| 'hostOrganizationId'
	| 'machineId'
	| 'placementKind'
	| 'maxHourlyPriceMicroUsd'
	| 'cpu'
	| 'memoryGib'
	| 'diskGib'
	| 'gpu'
	| 'wholeMachine'
	| 'interruptible'
>;

type TermsPolicy = (
	parties: PriceParties,
	listing: MachineListing,
	markupBasisPoints: number
) => PriceTermsResult;

@Injectable()
export class PlacementPriceService {
	constructor(
		private readonly settings: SettingsService,
		private readonly paymentChannels: PaymentChannelService
	) {}

	async open(
		manager: EntityManager,
		input: OpenPlacementPriceInput
	): Promise<PlacementPrice> {
		const { sandbox, placement, machine } = input;
		return this.start(
			manager,
			{
				sandboxId: sandbox.id,
				placementId: placement.id,
				customerOrganizationId: sandbox.organizationId,
				hostOrganizationId: machine.organizationId,
				machineId: machine.id,
				placementKind: sandbox.placementKind,
				maxHourlyPriceMicroUsd: sandbox.maxHourlyPriceMicroUsd,
				cpu: sandbox.cpu,
				memoryGib: sandbox.mem,
				diskGib: sandbox.disk,
				gpu: sandbox.gpu,
				wholeMachine: sandbox.placementWholeMachine,
				interruptible: sandbox.placementInterruptible,
			},
			openingPriceTerms
		);
	}

	async end(
		manager: EntityManager,
		placementPriceId: string,
		reason: PriceEndReason
	): Promise<PlacementPrice> {
		const placementPrice = await manager.findOne(
			PlacementPrice,
			{ id: placementPriceId },
			{ lockMode: LockMode.PESSIMISTIC_WRITE }
		);
		if (!placementPrice) {
			throw new NotFoundException({
				code: MarketplaceErrorCode.PRICE_NOT_FOUND,
				message: 'Placement price not found',
			});
		}
		if (placementPrice.endedAt !== null) {
			throw new ConflictException({
				code: MarketplaceErrorCode.PRICE_NOT_OPEN,
				message: 'The placement price has already ended',
			});
		}
		placementPrice.endedAt = await databaseNow(manager);
		placementPrice.endReason = reason;
		await manager.flush();
		await this.paymentChannels.end(manager, placementPrice);
		return placementPrice;
	}

	async reprice(
		manager: EntityManager,
		placementPriceId: string
	): Promise<PlacementPrice> {
		const ended = await this.end(
			manager,
			placementPriceId,
			PriceEndReason.REPRICED
		);
		return this.start(manager, ended, repricedPriceTerms);
	}

	current(
		manager: EntityManager,
		sandboxId: string
	): Promise<PlacementPrice | null> {
		return manager.findOne(PlacementPrice, { sandboxId, endedAt: null });
	}

	async describe(
		manager: EntityManager,
		placementPrice: PlacementPrice
	): Promise<SandboxPriceDto> {
		const shape = ResourceShape.fromColumns(placementPrice);
		const card = placementPrice.priceCardId
			? await manager.findOneOrFail(MachinePriceCard, {
					id: placementPrice.priceCardId,
				})
			: null;
		const terms = recordedPriceTerms(placementPrice, card);
		return SandboxPriceDto.from(placementPrice, {
			hourly: runningHourlyPrice(terms, shape),
			stopped: stoppedHourlyPrice(terms, shape),
			diskGibMonthMicroUsd: terms.diskGibMonthMicroUsd,
			increasedHourlyGross: await this.increasedHourlyGross(
				manager,
				placementPrice
			),
		});
	}

	private async increasedHourlyGross(
		manager: EntityManager,
		placementPrice: PlacementPrice
	): Promise<MicroUsd | null> {
		if (placementPrice.priceIncreaseCardId === null) return null;
		const card = await manager.findOneOrFail(MachinePriceCard, {
			id: placementPrice.priceIncreaseCardId,
		});
		return repricedHourlyGross(placementPrice, card, await this.settings.get());
	}

	private async start(
		manager: EntityManager,
		template: PriceTemplate,
		policy: TermsPolicy
	): Promise<PlacementPrice> {
		const listing = await manager.findOneOrFail(
			MachineListing,
			{ machineId: template.machineId },
			{ lockMode: LockMode.PESSIMISTIC_READ }
		);
		const settings = await this.settings.get();
		const result = policy(
			{
				customerOrganizationId: template.customerOrganizationId,
				hostOrganizationId: template.hostOrganizationId,
			},
			listing,
			marketMarkupBasisPoints(settings)
		);
		if (result.terms === null) {
			throw new PriceTermsUnavailableError(
				template.machineId,
				result.unavailableReason
			);
		}
		const startedAt = await databaseNow(manager);
		const placementPrice = new PlacementPrice();
		placementPrice.id = v4();
		placementPrice.sandboxId = template.sandboxId;
		placementPrice.placementId = template.placementId;
		placementPrice.customerOrganizationId = template.customerOrganizationId;
		placementPrice.hostOrganizationId = template.hostOrganizationId;
		placementPrice.machineId = template.machineId;
		placementPrice.priceCardId = result.terms.priceCardId;
		placementPrice.markupBasisPoints = result.terms.markupBasisPoints;
		placementPrice.placementKind = template.placementKind;
		placementPrice.maxHourlyPriceMicroUsd = template.maxHourlyPriceMicroUsd;
		placementPrice.cpu = template.cpu;
		placementPrice.memoryGib = template.memoryGib;
		placementPrice.diskGib = template.diskGib;
		placementPrice.gpu = template.gpu;
		placementPrice.wholeMachine = template.wholeMachine;
		placementPrice.interruptible = template.interruptible;
		placementPrice.startedAt = startedAt;
		placementPrice.priceIncreaseAt = null;
		placementPrice.priceIncreaseCardId = null;
		manager.persist(placementPrice);
		await manager.flush();
		await this.paymentChannels.attach(manager, placementPrice);
		return placementPrice;
	}
}
