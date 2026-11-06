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
import { PlacementBillingCapacityService } from '../../billing/services/placement/placement-billing-capacity.service';
import { placementPriceTerms } from '../../billing/utils/lease-pricing.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { geoPoint } from '../../location/utils/geo-distance.util';
import { Machine } from '../../machine/entities/machine.entity';
import { MachineState } from '../../machine/enums/machine-state.enum';
import type { CustomerMachineParams } from '../../machine/types/machine-scheduling.types';
import { MachineListing } from '../../marketplace/entities/machine-listing.entity';
import { MachinePriceCard } from '../../marketplace/entities/machine-price-card.entity';
import { ListingState } from '../../marketplace/enums/listing-state.enum';
import { ListingVisibility } from '../../marketplace/enums/listing-visibility.enum';
import { MachineTier } from '../../marketplace/enums/machine-tier.enum';
import { MachineUnavailableReason } from '../../marketplace/enums/machine-unavailable-reason.enum';
import { PlacementKind } from '../../marketplace/enums/placement-kind.enum';
import type { LeaseTermsUnavailableError } from '../../marketplace/exceptions/lease-terms-unavailable.exception';
import type { PriceTerms } from '../../marketplace/types/pricing.types';
import { marketMarkupBasisPoints } from '../../marketplace/utils/markup.util';
import { runningHourlyPrice } from '../../marketplace/utils/pricing.util';
import { MACHINE_ALTERNATIVE_LIMIT } from '../../sandbox/constants/sandbox-placement.constants';
import type { SandboxPlacementAlternativeDto } from '../../sandbox/dto/sandbox-quote.dto';
import type { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { SettingsService } from '../../settings/services/settings.service';
import { MachineUnavailableException } from '../exceptions/machine-unavailable.exception';
import { requestedShape } from '../queries/machine-candidates.query';
import { sandboxSchedulingParameters } from '../utils/sandbox-scheduling.util';
import { MachineSchedulingService } from './machine-scheduling.service';

export interface PinnedMachineTerms {
	machine: Machine;
	priceCardId: string | null;
	terms: PriceTerms;
}

@Injectable()
export class MachineAvailabilityService {
	constructor(
		private readonly scheduling: MachineSchedulingService,
		private readonly capacity: PlacementBillingCapacityService,
		private readonly settings: SettingsService
	) {}

	async pinnedTerms(
		manager: EntityManager,
		machineId: string,
		customerOrganizationId: string
	): Promise<PinnedMachineTerms> {
		const machine = await manager.findOneOrFail(Machine, { id: machineId });
		const listing = await manager.findOneOrFail(MachineListing, {
			machineId,
		});
		const selfUse = machine.organizationId === customerOrganizationId;
		const card =
			!selfUse && listing.currentPriceCardId
				? await manager.findOneOrFail(MachinePriceCard, {
						id: listing.currentPriceCardId,
					})
				: null;
		return {
			machine,
			priceCardId: card?.id ?? null,
			terms: placementPriceTerms(
				card,
				marketMarkupBasisPoints(await this.settings.get(), machine.tier)
			),
		};
	}

	async reason(
		manager: EntityManager,
		params: CustomerMachineParams,
		machineId: string
	): Promise<MachineUnavailableReason> {
		const { machine } = await this.pinnedTerms(
			manager,
			machineId,
			params.customerOrganizationId
		);
		const listing = await manager.findOneOrFail(MachineListing, {
			machineId,
		});
		const own = machine.organizationId === params.customerOrganizationId;
		const offered =
			listing.state === ListingState.LISTED &&
			(own ||
				(listing.visibility === ListingVisibility.PUBLIC &&
					machine.tier !== MachineTier.PRIVATE &&
					machine.restrictedAt === null));
		if (!offered) return MachineUnavailableReason.PAUSED;
		const now = await databaseNow(manager);
		if (
			machine.state !== MachineState.READY ||
			machine.unschedulable ||
			machine.draining ||
			!machine.sessionExpiresAt ||
			machine.sessionExpiresAt <= now
		) {
			return MachineUnavailableReason.OFFLINE;
		}
		const eligible = await this.scheduling.eligibleMachines(params, manager, [
			machineId,
		]);
		return eligible.length > 0
			? MachineUnavailableReason.EXPOSURE_LIMITED
			: MachineUnavailableReason.FULL;
	}

	async alternatives(
		manager: EntityManager,
		params: CustomerMachineParams,
		machineId: string
	): Promise<SandboxPlacementAlternativeDto[]> {
		const pinned = await this.pinnedTerms(
			manager,
			machineId,
			params.customerOrganizationId
		);
		const ranked = await this.scheduling.rank(
			{
				...params,
				excludedMachineIds: [...(params.excludedMachineIds ?? []), machineId],
				placement: {
					kind: PlacementKind.FLEXIBLE,
					locations: [],
					ownMachinesOnly: false,
					origin: geoPoint(pinned.machine),
					category: pinned.machine.category ?? undefined,
					minimumTier:
						pinned.machine.tier === MachineTier.PRIVATE
							? undefined
							: pinned.machine.tier,
					maxHourlyPriceMicroUsd: runningHourlyPrice(
						pinned.terms,
						requestedShape(params)
					).grossMicroUsd,
				},
			},
			manager
		);
		const admissible = await this.capacity.admissibleCandidates(
			manager,
			params.customerOrganizationId,
			ranked
		);
		return admissible.slice(0, MACHINE_ALTERNATIVE_LIMIT).map((candidate) => ({
			machineId: candidate.machineId,
			location: candidate.location,
			priceCardId: candidate.priceCardId ?? undefined,
			hourlyPriceMicroUsd: candidate.hourlyGrossMicroUsd.toString(),
			reliabilityBasisPoints: candidate.reliabilityBasisPoints,
		}));
	}

	async leaseUnavailable(
		manager: EntityManager,
		sandbox: Sandbox,
		error: LeaseTermsUnavailableError
	): Promise<MachineUnavailableException> {
		return new MachineUnavailableException(
			error.machineId,
			error.reason,
			await this.alternatives(
				manager,
				sandboxSchedulingParameters(sandbox),
				error.machineId
			)
		);
	}

	async unavailable(
		manager: EntityManager,
		params: CustomerMachineParams,
		machineId: string
	): Promise<MachineUnavailableException> {
		return new MachineUnavailableException(
			machineId,
			await this.reason(manager, params, machineId),
			await this.alternatives(manager, params, machineId)
		);
	}
}
