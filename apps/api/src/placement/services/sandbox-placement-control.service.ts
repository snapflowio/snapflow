/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { ConflictException, Injectable } from '@nestjs/common';
import { PlacementBillingAuthorizationService } from '../../billing/services/placement/placement-billing-authorization.service';
import { PlacementBillingCapacityService } from '../../billing/services/placement/placement-billing-capacity.service';
import { MILLISECONDS_PER_MINUTE } from '../../common/constants/time.constants';
import { addMilliseconds } from '../../common/utils/time.util';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { geoPoint } from '../../location/utils/geo-distance.util';
import { parseLocationConstraint } from '../../location/utils/location-constraint.util';
import { Machine } from '../../machine/entities/machine.entity';
import type { CustomerMachineParams } from '../../machine/types/machine-scheduling.types';
import type { SandboxLeaseDto } from '../../marketplace/dto/sandbox-lease.dto';
import { MachineListing } from '../../marketplace/entities/machine-listing.entity';
import type { SandboxLease } from '../../marketplace/entities/sandbox-lease.entity';
import { LeaseRenewalState } from '../../marketplace/enums/lease-renewal-state.enum';
import { ListingVisibility } from '../../marketplace/enums/listing-visibility.enum';
import { MachineTier } from '../../marketplace/enums/machine-tier.enum';
import { MachineUnavailableReason } from '../../marketplace/enums/machine-unavailable-reason.enum';
import { MarketplaceErrorCode } from '../../marketplace/enums/marketplace-error-code.enum';
import { PlacementKind } from '../../marketplace/enums/placement-kind.enum';
import { LeaseTermsUnavailableError } from '../../marketplace/exceptions/lease-terms-unavailable.exception';
import { SandboxLeaseService } from '../../marketplace/services/sandbox-lease.service';
import type {
	MoveSandboxDto,
	StartSandboxDto,
} from '../../sandbox/dto/sandbox-placement.dto';
import type { SandboxQuoteDto } from '../../sandbox/dto/sandbox-quote.dto';
import type { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { SandboxPlacementErrorCode } from '../../sandbox/enums/sandbox-placement-error-code.enum';
import { SandboxState } from '../../sandbox/enums/sandbox-state.enum';
import { WhenMachineUnavailable } from '../../sandbox/enums/when-machine-unavailable.enum';
import { SettingsService } from '../../settings/services/settings.service';
import { BackupState } from '../../volume/enums/backup-state.enum';
import { MachineUnavailableException } from '../exceptions/machine-unavailable.exception';
import { sandboxSchedulingParameters } from '../utils/sandbox-scheduling.util';
import { MachineAvailabilityService } from './machine-availability.service';
import { MachineSchedulingService } from './machine-scheduling.service';
import { PlacementQuoteService } from './placement-quote.service';
import { SandboxPlacementService } from './sandbox-placement.service';

const RENEWAL_QUOTE_MACHINE_COUNT = 1;

const RELOCATABLE_STATES: readonly SandboxState[] = [
	SandboxState.STOPPED,
	SandboxState.ARCHIVED,
];

export type PlacementUpdate = Partial<
	Pick<Sandbox, 'placementKind' | 'pinnedMachineId' | 'startWaitUntil'>
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
		private readonly leases: SandboxLeaseService,
		private readonly quotes: PlacementQuoteService,
		private readonly settings: SettingsService
	) {}

	async prepareStart(
		sandbox: Sandbox,
		input: StartSandboxDto
	): Promise<PlacementUpdate> {
		await this.assertLeaseUsable(sandbox);
		if (
			sandbox.placementKind !== PlacementKind.PINNED ||
			!sandbox.pinnedMachineId ||
			!RELOCATABLE_STATES.includes(sandbox.state)
		) {
			return {};
		}
		const machineId = sandbox.pinnedMachineId;
		if (await this.machineTakes(sandbox, machineId)) {
			return { startWaitUntil: null };
		}
		switch (input.whenMachineUnavailable) {
			case WhenMachineUnavailable.WAIT: {
				const { pinnedStartWaitMinutes } = await this.settings.get();
				const now = await databaseNow(this.entityManager);
				return {
					startWaitUntil: addMilliseconds(
						now,
						pinnedStartWaitMinutes * MILLISECONDS_PER_MINUTE
					),
				};
			}
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
			throw new ConflictException('Stop the sandbox before moving it');
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

	async describeLease(sandbox: Sandbox): Promise<SandboxLeaseDto> {
		return this.leases.describe(
			this.entityManager,
			await this.requireLease(this.entityManager, sandbox.id)
		);
	}

	async acceptRenewal(
		sandbox: Sandbox,
		priceCardId: string
	): Promise<SandboxLeaseDto> {
		return this.entityManager.transactional(async (manager) => {
			const lease = await this.requireLease(manager, sandbox.id);
			const listing = await manager.findOneOrFail(
				MachineListing,
				{ machineId: lease.machineId },
				{ lockMode: LockMode.PESSIMISTIC_READ }
			);
			if (listing.currentPriceCardId !== priceCardId) {
				throw new ConflictException({
					code: SandboxPlacementErrorCode.PRICE_CHANGED,
					message: 'The machine price changed since it was quoted',
					quote: await this.renewalQuote(manager, sandbox, lease.machineId),
				});
			}
			return this.leases.describe(
				manager,
				await this.renewLease(manager, sandbox, lease)
			);
		});
	}

	async renewLease(
		manager: EntityManager,
		sandbox: Sandbox,
		lease: SandboxLease
	): Promise<SandboxLease> {
		const renewed = await this.renewTerms(manager, sandbox, lease);
		await this.billingAuthorizations.attachLease(
			manager,
			renewed.placementId,
			renewed.id,
			await this.placements.hourlyGross(manager, renewed)
		);
		return renewed;
	}

	private async renewTerms(
		manager: EntityManager,
		sandbox: Sandbox,
		lease: SandboxLease
	): Promise<SandboxLease> {
		try {
			return await this.leases.renew(manager, lease.id);
		} catch (error) {
			if (error instanceof LeaseTermsUnavailableError) {
				throw await this.availability.leaseUnavailable(manager, sandbox, error);
			}
			throw error;
		}
	}

	private async renewalQuote(
		manager: EntityManager,
		sandbox: Sandbox,
		machineId: string
	): Promise<SandboxQuoteDto> {
		const pinned = await this.availability.pinnedTerms(
			manager,
			machineId,
			sandbox.organizationId
		);
		return this.quotes.quoteTerms(
			manager,
			{
				...sandboxSchedulingParameters(sandbox),
				placement: { kind: PlacementKind.PINNED, machineId },
			},
			pinned.terms,
			{
				eligibleMachineCount: RENEWAL_QUOTE_MACHINE_COUNT,
				machine: { machineId, priceCardId: pinned.priceCardId },
			}
		);
	}

	private async assertLeaseUsable(sandbox: Sandbox): Promise<void> {
		const lease = await this.leases.current(this.entityManager, sandbox.id);
		if (
			!lease ||
			lease.renewalState !== LeaseRenewalState.RENEWAL_REQUIRED ||
			!lease.renewalDeadline ||
			lease.renewalDeadline > (await databaseNow(this.entityManager))
		) {
			return;
		}
		throw new ConflictException({
			code: SandboxPlacementErrorCode.LEASE_RENEWAL_REQUIRED,
			message: 'Accept the renewed price or move the sandbox to start it',
			leaseId: lease.id,
			renewalDeadline: lease.renewalDeadline,
		});
	}

	private async requireLease(
		manager: EntityManager,
		sandboxId: string
	): Promise<SandboxLease> {
		const lease = await this.leases.current(manager, sandboxId);
		if (!lease) {
			throw new ConflictException({
				code: MarketplaceErrorCode.LEASE_NOT_OPEN,
				message: 'The sandbox has no open lease',
			});
		}
		return lease;
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
		return {
			...sandboxSchedulingParameters(sandbox),
			placement: { kind: PlacementKind.PINNED, machineId },
			diskGiB: sandbox.machineId === machineId ? 0 : sandbox.disk,
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
				? await this.currentLeaseGross(sandbox.id)
				: MicroUsd.parse(maxHourlyPriceMicroUsd);
		const params: CustomerMachineParams = {
			...sandboxSchedulingParameters(sandbox),
			excludedMachineIds: currentMachineId ? [currentMachineId] : [],
			placement: {
				kind: PlacementKind.FLEXIBLE,
				locations: sandbox.placementLocations.map(parseLocationConstraint),
				ownMachinesOnly: sandbox.placementOwnMachinesOnly,
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
				maxEgressMicroUsdPerGiB:
					MicroUsd.parseNullable(sandbox.maxEgressMicroUsdPerGiB) ?? undefined,
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

	private async currentLeaseGross(
		sandboxId: string
	): Promise<MicroUsd | undefined> {
		const lease = await this.leases.current(this.entityManager, sandboxId);
		return lease
			? this.placements.hourlyGross(this.entityManager, lease)
			: undefined;
	}

	private relocation(sandbox: Sandbox, machineId: string): PlacementUpdate {
		if (
			sandbox.backupState !== BackupState.COMPLETED &&
			sandbox.machineId !== machineId
		) {
			throw new ConflictException(
				'The sandbox needs a completed backup before it can move'
			);
		}
		return {
			placementKind: PlacementKind.PINNED,
			pinnedMachineId: machineId,
			startWaitUntil: null,
		};
	}
}
