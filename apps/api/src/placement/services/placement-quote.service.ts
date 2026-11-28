/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import type { BillingRestriction } from '../../billing/enums/billing-restriction.enum';
import { PlacementBillingCapacityService } from '../../billing/services/placement/placement-billing-capacity.service';
import type { CustomerMachineParams } from '../../machine/types/machine-scheduling.types';
import { MachinePriceCard } from '../../marketplace/entities/machine-price-card.entity';
import type { MachineUnavailableReason } from '../../marketplace/enums/machine-unavailable-reason.enum';
import type { PriceTerms } from '../../marketplace/types/pricing.types';
import { runningHourlyPrice } from '../../marketplace/utils/pricing/pricing.util';
import { machineHourMicroUsd } from '../../marketplace/utils/pricing/slice-pricing.util';
import type { SandboxQuoteDto } from '../../sandbox/dto/sandbox-quote.dto';
import { SettingsService } from '../../settings/services/settings.service';
import { requestedShape } from '../queries/machine-candidates.query';
import { type QuotedMachine, sandboxQuote } from '../utils/sandbox-quote.util';
import type { PlacementCandidate } from './machine-scheduling.service';

interface QuoteDetails {
	eligibleMachineCount: number;
	machine?: QuotedMachine;
	unavailableReason?: MachineUnavailableReason;
	billingRestriction?: BillingRestriction;
}

@Injectable()
export class PlacementQuoteService {
	constructor(
		private readonly capacity: PlacementBillingCapacityService,
		private readonly settings: SettingsService
	) {}

	quoteCandidate(
		manager: EntityManager,
		params: CustomerMachineParams,
		candidate: PlacementCandidate,
		eligibleMachineCount: number
	): Promise<SandboxQuoteDto> {
		return this.quoteTerms(manager, params, candidate.terms, {
			eligibleMachineCount,
			machine: {
				machineId: candidate.machineId,
				priceCardId: candidate.priceCardId,
			},
		});
	}

	async quoteTerms(
		manager: EntityManager,
		params: CustomerMachineParams,
		terms: PriceTerms,
		details: QuoteDetails
	): Promise<SandboxQuoteDto> {
		const shape = requestedShape(params);
		const minimumFundingMicroUsd = await this.capacity.startRequirement(
			manager,
			params.customerOrganizationId,
			runningHourlyPrice(terms, shape).grossMicroUsd
		);
		const { priceLockDays } = await this.settings.get();
		const card = details.machine?.priceCardId
			? await manager.findOneOrFail(MachinePriceCard, {
					id: details.machine.priceCardId,
				})
			: null;
		return sandboxQuote(terms, shape, {
			...details,
			placementKind: params.placement.kind,
			wholeMachine: params.placement.wholeMachine,
			priceLockDays,
			minimumFundingMicroUsd,
			wholeMachineHourMicroUsd: card ? machineHourMicroUsd(card) : null,
		});
	}
}
