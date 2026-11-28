/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { ConflictException, Injectable } from '@nestjs/common';
import { BillingRunwayService } from '../../billing/services/billing-runway.service';
import { PlacementBillingAuthorizationService } from '../../billing/services/placement/placement-billing-authorization.service';
import { PlacementBillingCapacityService } from '../../billing/services/placement/placement-billing-capacity.service';
import { apiError } from '../../common/utils/error/api-error.util';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { geoPoint } from '../../location/utils/geo-distance.util';
import { parseLocationConstraint } from '../../location/utils/location-constraint.util';
import { Machine } from '../../machine/entities/machine.entity';
import type { CustomerMachineParams } from '../../machine/types/machine-scheduling.types';
import type { SandboxPriceDto } from '../../marketplace/dto/sandbox-price.dto';
import { MachineListing } from '../../marketplace/entities/machine-listing.entity';
import type { PlacementPrice } from '../../marketplace/entities/placement-price.entity';
import { ListingVisibility } from '../../marketplace/enums/listing-visibility.enum';
import { MachineTier } from '../../marketplace/enums/machine-tier.enum';
import { MachineUnavailableReason } from '../../marketplace/enums/machine-unavailable-reason.enum';
import { MarketplaceErrorCode } from '../../marketplace/enums/marketplace-error-code.enum';
import { PlacementKind } from '../../marketplace/enums/placement-kind.enum';
import { PriceTermsUnavailableError } from '../../marketplace/exceptions/price-terms-unavailable.exception';
import { PlacementPriceService } from '../../marketplace/services/placement-price.service';
import type {
	MoveSandboxDto,
	StartSandboxDto,
} from '../../sandbox/dto/sandbox-placement.dto';
import type { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { SandboxPlacementErrorCode } from '../../sandbox/enums/sandbox-placement-error-code.enum';
import { SandboxState } from '../../sandbox/enums/sandbox-state.enum';
import { WhenMachineUnavailable } from '../../sandbox/enums/when-machine-unavailable.enum';
import { BackupState } from '../../volume/enums/backup-state.enum';
import { PlacementErrorCode } from '../enums/placement-error-code.enum';
import { MachineUnavailableException } from '../exceptions/machine-unavailable.exception';
import { sandboxSchedulingParameters } from '../utils/sandbox-scheduling.util';
import { MachineAvailabilityService } from './machine-availability.service';
import { MachineSchedulingService } from './machine-scheduling.service';
import { PlacementQuoteService } from './placement-quote.service';
import { SandboxPlacementService } from './sandbox-placement.service';

const RELOCATABLE_STATES: readonly SandboxState[] = [
	SandboxState.STOPPED,
	SandboxState.ARCHIVED,
];

export type PlacementUpdate = Partial<
	Pick<Sandbox, 'placementKind' | 'pinnedMachineId'>
>;

@Injectable()
export class SandboxPlacementControlService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly scheduling: MachineSchedulingService,
		private readonly capacity: PlacementBillingCapacityService,
		private readonly availability: MachineAvailabilityService,
		private readonly placements: SandboxPlacementService,
		private readonly billingAuthorizations: PlacementBillingAuthorizationService,
		private readonly placementPrices: PlacementPriceService,
		private readonly quotes: PlacementQuoteService,
		private readonly runway: BillingRunwayService
	) {}

	async prepareStart(
		sandbox: Sandbox,
		input: StartSandboxDto
	): Promise<PlacementUpdate> {
		await this.assertStartAffordable(sandbox);
		if (
			sandbox.placementKind !== PlacementKind.PINNED ||
			!sandbox.pinnedMachineId ||
			!RELOCATABLE_STATES.includes(sandbox.state)
		) {
			return {};
		}
		const machineId = sandbox.pinnedMachineId;
		if (await this.machineTakes(sandbox, machineId)) {
			return {};
		}
		switch (input.whenMachineUnavailable) {
			case WhenMachineUnavailable.WAIT:
				return {};
			case WhenMachineUnavailable.MOVE:
				return this.relocation(
					sandbox,
					await this.flexibleTarget(sandbox, input.maxHourlyPriceMicroUsd)
				);
			case WhenMachineUnavailable.FAIL:
				throw await this.availability.unavailable(
					this.entityManager,
					sandboxSchedulingParameters(sandbox),
					machineId
				);
		}
	}

	async prepareMove(
		sandbox: Sandbox,
		input: MoveSandboxDto
	): Promise<PlacementUpdate> {
		if (!RELOCATABLE_STATES.includes(sandbox.state) || sandbox.pending) {
			throw new ConflictException(
				apiError(
					PlacementErrorCode.MOVE_REQUIRES_STOPPED_SANDBOX,
					'The sandbox is running. Stop the sandbox, then move it.'
				)
			);
		}
		if (input.machineId === undefined) {
			return this.relocation(
				sandbox,
				await this.flexibleTarget(sandbox, input.maxHourlyPriceMicroUsd)
			);
		}
		await this.assertOffered(sandbox.organizationId, input.machineId);
		if (!(await this.machineTakes(sandbox, input.machineId))) {
			throw await this.availability.unavailable(
				this.entityManager,
				this.pinnedParameters(sandbox, input.machineId),
				input.machineId
			);
		}
		return this.relocation(sandbox, input.machineId);
	}

	async describePrice(sandbox: Sandbox): Promise<SandboxPriceDto> {
		return this.placementPrices.describe(
			this.entityManager,
			await this.requirePrice(this.entityManager, sandbox.id)
		);
	}

	async repricePlacement(
		manager: EntityManager,
		sandbox: Sandbox,
		placementPrice: PlacementPrice
	): Promise<PlacementPrice> {
		const repriced = await this.repriceTerms(manager, sandbox, placementPrice);
		await this.billingAuthorizations.attachPrice(
			manager,
			repriced.placementId,
			repriced.id,
			await this.placements.hourlyGross(manager, repriced)
		);
		return repriced;
	}

	private async repriceTerms(
		manager: EntityManager,
		sandbox: Sandbox,
		placementPrice: PlacementPrice
	): Promise<PlacementPrice> {
		try {
			return await this.placementPrices.reprice(manager, placementPrice.id);
		} catch (error) {
			if (error instanceof PriceTermsUnavailableError) {
				throw await this.availability.priceUnavailable(manager, sandbox, error);
			}
			throw error;
		}
	}

	private async assertStartAffordable(sandbox: Sandbox): Promise<void> {
		const hourly = await this.currentHourlyGross(sandbox.id);
		if (hourly) this.assertWithinMaximum(sandbox, hourly);
		await this.runway.assertStartCovered(
			this.entityManager,
			sandbox.organizationId,
			hourly ?? ((await this.runsOnOwnMachines(sandbox)) ? MicroUsd.ZERO : null)
		);
	}

	private async runsOnOwnMachines(sandbox: Sandbox): Promise<boolean> {
		if (sandbox.placementKind !== PlacementKind.PINNED) {
			return sandbox.placementOwnMachinesOnly;
		}
		if (!sandbox.pinnedMachineId) return false;
		const machine = await this.entityManager.findOne(
			Machine,
			{ id: sandbox.pinnedMachineId },
			{ fields: ['organizationId'] }
		);
		return machine?.organizationId === sandbox.organizationId;
	}

	private assertWithinMaximum(sandbox: Sandbox, hourly: MicroUsd): void {
		const maximum = MicroUsd.parseNullable(sandbox.maxHourlyPriceMicroUsd);
		if (maximum === null || hourly.atMost(maximum)) return;
		throw new ConflictException({
			code: SandboxPlacementErrorCode.PRICE_ABOVE_MAXIMUM,
			message:
				"The machine's price is above the sandbox's maximum price; raise the maximum or move the sandbox",
			hourlyPriceMicroUsd: hourly.toString(),
			maxHourlyPriceMicroUsd: maximum.toString(),
		});
	}

	private async requirePrice(
		manager: EntityManager,
		sandboxId: string
	): Promise<PlacementPrice> {
		const placementPrice = await this.placementPrices.current(
			manager,
			sandboxId
		);
		if (!placementPrice) {
			throw new ConflictException({
				code: MarketplaceErrorCode.PRICE_NOT_OPEN,
				message: 'The sandbox has no open placement price',
			});
		}
		return placementPrice;
	}

	private async assertOffered(
		organizationId: string,
		machineId: string
	): Promise<void> {
		const listing = await this.entityManager.findOne(MachineListing, {
			machineId,
		});
		const machine = await this.entityManager.findOne(Machine, {
			id: machineId,
		});
		if (
			!listing ||
			!machine ||
			(machine.organizationId !== organizationId &&
				listing.visibility === ListingVisibility.PRIVATE)
		) {
			throw new ConflictException({
				code: MarketplaceErrorCode.MACHINE_NOT_FOUND,
				message: 'Machine not found',
			});
		}
	}

	private pinnedParameters(
		sandbox: Sandbox,
		machineId: string
	): CustomerMachineParams {
		const resident = sandbox.machineId === machineId;
		return {
			...sandboxSchedulingParameters(sandbox),
			placement: {
				kind: PlacementKind.PINNED,
				machineId,
				wholeMachine: sandbox.placementWholeMachine,
				maxHourlyPriceMicroUsd:
					MicroUsd.parseNullable(sandbox.maxHourlyPriceMicroUsd) ?? undefined,
			},
			diskGiB: resident ? 0 : sandbox.disk,
			resident,
		};
	}

	private async machineTakes(
		sandbox: Sandbox,
		machineId: string
	): Promise<boolean> {
		const eligible = await this.scheduling.eligibleMachines(
			this.pinnedParameters(sandbox, machineId),
			this.entityManager,
			[machineId]
		);
		const { admitted, restriction } = await this.capacity.admit(
			this.entityManager,
			sandbox.organizationId,
			eligible
		);
		if (restriction) throw restriction;
		return admitted.length > 0;
	}

	private async flexibleTarget(
		sandbox: Sandbox,
		maxHourlyPriceMicroUsd: string | undefined
	): Promise<string> {
		const currentMachineId = sandbox.pinnedMachineId ?? sandbox.machineId;
		const machine = currentMachineId
			? await this.entityManager.findOne(Machine, {
					id: currentMachineId,
				})
			: null;
		const cap =
			maxHourlyPriceMicroUsd === undefined
				? await this.currentHourlyGross(sandbox.id)
				: MicroUsd.parse(maxHourlyPriceMicroUsd);
		const params: CustomerMachineParams = {
			...sandboxSchedulingParameters(sandbox),
			excludedMachineIds: currentMachineId ? [currentMachineId] : [],
			placement: {
				kind: PlacementKind.FLEXIBLE,
				locations: sandbox.placementLocations.map(parseLocationConstraint),
				ownMachinesOnly: sandbox.placementOwnMachinesOnly,
				wholeMachine: sandbox.placementWholeMachine,
				origin:
					(machine && geoPoint(machine)) ??
					geoPoint({
						latitude: sandbox.originLatitude,
						longitude: sandbox.originLongitude,
					}),
				category: machine?.category ?? undefined,
				minimumTier:
					machine && machine.tier !== MachineTier.PRIVATE
						? machine.tier
						: undefined,
				maxHourlyPriceMicroUsd: cap,
			},
		};
		const ranked = await this.scheduling.rank(params, this.entityManager);
		const {
			admitted: [target],
			restriction,
		} = await this.capacity.admit(
			this.entityManager,
			sandbox.organizationId,
			ranked
		);
		if (restriction) throw restriction;
		if (!target) {
			throw new MachineUnavailableException(
				currentMachineId ?? sandbox.id,
				MachineUnavailableReason.FULL,
				[]
			);
		}
		return target.machineId;
	}

	async currentHourlyGross(sandboxId: string): Promise<MicroUsd | undefined> {
		const placementPrice = await this.placementPrices.current(
			this.entityManager,
			sandboxId
		);
		return placementPrice
			? this.placements.hourlyGross(this.entityManager, placementPrice)
			: undefined;
	}

	private relocation(sandbox: Sandbox, machineId: string): PlacementUpdate {
		if (
			sandbox.backupState !== BackupState.COMPLETED &&
			sandbox.machineId !== machineId
		) {
			throw new ConflictException(
				apiError(
					PlacementErrorCode.MOVE_REQUIRES_BACKUP,
					'The sandbox has no completed backup yet. Wait for its backup to finish, then move it.'
				)
			);
		}
		return {
			placementKind: PlacementKind.PINNED,
			pinnedMachineId: machineId,
		};
	}
}
