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
import { ResourceShape } from '../../common/values/resource-shape.value';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { SettingsService } from '../../settings/services/settings.service';
import { PaymentChannelService } from '../../settlement/services/payment-channel.service';
import { SandboxLeaseDto } from '../dto/sandbox-lease.dto';
import { MachineListing } from '../entities/machine-listing.entity';
import { MachinePriceCard } from '../entities/machine-price-card.entity';
import { SandboxLease } from '../entities/sandbox-lease.entity';
import { LeaseEndReason } from '../enums/lease-end-reason.enum';
import { MarketplaceErrorCode } from '../enums/marketplace-error-code.enum';
import { LeaseTermsUnavailableError } from '../exceptions/lease-terms-unavailable.exception';
import type { OpenLeaseInput } from '../types/machine.types';
import {
	egressPricePerGiB,
	priceTerms,
	runningHourlyPrice,
	stoppedHourlyPrice,
	ZERO_LINE_PRICE,
} from '../utils/pricing.util';
import {
	type LeaseParties,
	type LeaseTermsResult,
	openingLeaseTerms,
	priceLockedUntil,
	renewalLeaseTerms,
} from '../utils/sandbox-lease.util';

type LeaseTemplate = Pick<
	SandboxLease,
	| 'sandboxId'
	| 'placementId'
	| 'customerOrganizationId'
	| 'hostOrganizationId'
	| 'machineId'
	| 'placementKind'
	| 'maxHourlyPriceMicroUsd'
	| 'maxEgressMicroUsdPerGiB'
	| 'cpu'
	| 'memoryGib'
	| 'diskGib'
	| 'gpu'
>;

type TermsPolicy = (
	parties: LeaseParties,
	listing: MachineListing,
	markupBasisPoints: number
) => LeaseTermsResult;

@Injectable()
export class SandboxLeaseService {
	constructor(
		private readonly settings: SettingsService,
		private readonly channels: PaymentChannelService
	) {}

	async open(
		manager: EntityManager,
		input: OpenLeaseInput
	): Promise<SandboxLease> {
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
				maxEgressMicroUsdPerGiB: sandbox.maxEgressMicroUsdPerGiB,
				cpu: sandbox.cpu,
				memoryGib: sandbox.mem,
				diskGib: sandbox.disk,
				gpu: sandbox.gpu,
			},
			openingLeaseTerms
		);
	}

	async end(
		manager: EntityManager,
		leaseId: string,
		reason: LeaseEndReason
	): Promise<SandboxLease> {
		const lease = await manager.findOne(
			SandboxLease,
			{ id: leaseId },
			{ lockMode: LockMode.PESSIMISTIC_WRITE }
		);
		if (!lease) {
			throw new NotFoundException({
				code: MarketplaceErrorCode.LEASE_NOT_FOUND,
				message: 'Lease not found',
			});
		}
		if (lease.endedAt !== null) {
			throw new ConflictException({
				code: MarketplaceErrorCode.LEASE_NOT_OPEN,
				message: 'The lease has already ended',
			});
		}
		lease.endedAt = await databaseNow(manager);
		lease.endReason = reason;
		await manager.flush();
		await this.channels.close(manager, lease);
		return lease;
	}

	async renew(manager: EntityManager, leaseId: string): Promise<SandboxLease> {
		const ended = await this.end(manager, leaseId, LeaseEndReason.RENEWED);
		return this.start(manager, ended, renewalLeaseTerms);
	}

	current(
		manager: EntityManager,
		sandboxId: string
	): Promise<SandboxLease | null> {
		return manager.findOne(SandboxLease, { sandboxId, endedAt: null });
	}

	async describe(
		manager: EntityManager,
		lease: SandboxLease
	): Promise<SandboxLeaseDto> {
		const shape = ResourceShape.fromColumns(lease);
		const card = lease.priceCardId
			? await manager.findOneOrFail(MachinePriceCard, { id: lease.priceCardId })
			: null;
		const terms = card ? priceTerms(card, lease.markupBasisPoints) : null;
		return SandboxLeaseDto.from(lease, {
			hourly: terms ? runningHourlyPrice(terms, shape) : ZERO_LINE_PRICE,
			stopped: terms ? stoppedHourlyPrice(terms, shape) : ZERO_LINE_PRICE,
			egressPerGiB: terms ? egressPricePerGiB(terms) : ZERO_LINE_PRICE,
		});
	}

	private async start(
		manager: EntityManager,
		template: LeaseTemplate,
		policy: TermsPolicy
	): Promise<SandboxLease> {
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
			settings.platformMarkupBasisPoints
		);
		if (result.terms === null) {
			throw new LeaseTermsUnavailableError(
				template.machineId,
				result.unavailableReason
			);
		}
		const startedAt = await databaseNow(manager);
		const lease = new SandboxLease();
		lease.id = v4();
		lease.sandboxId = template.sandboxId;
		lease.placementId = template.placementId;
		lease.customerOrganizationId = template.customerOrganizationId;
		lease.hostOrganizationId = template.hostOrganizationId;
		lease.machineId = template.machineId;
		lease.priceCardId = result.terms.priceCardId;
		lease.markupBasisPoints = result.terms.markupBasisPoints;
		lease.placementKind = template.placementKind;
		lease.maxHourlyPriceMicroUsd = template.maxHourlyPriceMicroUsd;
		lease.maxEgressMicroUsdPerGiB = template.maxEgressMicroUsdPerGiB;
		lease.cpu = template.cpu;
		lease.memoryGib = template.memoryGib;
		lease.diskGib = template.diskGib;
		lease.gpu = template.gpu;
		lease.startedAt = startedAt;
		lease.priceLockedUntil = priceLockedUntil(
			startedAt,
			settings.priceLockDays
		);
		manager.persist(lease);
		await manager.flush();
		await this.channels.open(manager, lease);
		return lease;
	}
}
