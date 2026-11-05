/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode, TransactionPropagation } from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/postgresql';
import {
	ConflictException,
	HttpException,
	Injectable,
	Logger,
} from '@nestjs/common';
import { BillingRestrictedException } from '../../billing/exceptions/billing-restricted.exception';
import { PlacementBillingCapacityService } from '../../billing/services/placement/placement-billing-capacity.service';
import type { Machine } from '../../machine/entities/machine.entity';
import type { CustomerMachineParams } from '../../machine/types/machine-scheduling.types';
import { lockMachinesForUpdate } from '../../machine/utils/machine-lock.util';
import { MachineListing } from '../../marketplace/entities/machine-listing.entity';
import { PlacementKind } from '../../marketplace/enums/placement-kind.enum';
import type { PlacementLocality } from '../../sandbox/enums/placement-locality.enum';
import { SandboxPlacementErrorCode } from '../../sandbox/enums/sandbox-placement-error-code.enum';
import { NoAvailableMachineError } from '../exceptions/no-available-machine.exception';
import { MachineAvailabilityService } from './machine-availability.service';
import {
	MachineSchedulingService,
	type PlacementCandidate,
} from './machine-scheduling.service';
import { PlacementQuoteService } from './placement-quote.service';

const RESERVATION_REJECTION = {
	MACHINE_MISSING: 'machine_missing',
	INELIGIBLE: 'ineligible',
	LISTING_MISSING: 'listing_missing',
	CAPACITY: 'capacity',
} as const;
type ReservationRejection =
	(typeof RESERVATION_REJECTION)[keyof typeof RESERVATION_REJECTION];

export interface ReservedMachine {
	machine: Machine;
	locality: PlacementLocality;
}

class ReservationRejectedError extends Error {
	constructor(
		readonly reason: ReservationRejection,
		readonly restriction: BillingRestrictedException | null = null
	) {
		super(`Machine reservation rejected: ${reason}`);
	}
}

class PriceChangedError extends Error {
	constructor(readonly candidate: PlacementCandidate) {
		super(`Machine ${candidate.machineId} changed its price card`);
	}
}

@Injectable()
export class MachineReservationService {
	private readonly logger = new Logger(MachineReservationService.name);

	constructor(
		private readonly machines: MachineSchedulingService,
		private readonly capacity: PlacementBillingCapacityService,
		private readonly availability: MachineAvailabilityService,
		private readonly quotes: PlacementQuoteService
	) {}

	async reserve(
		manager: EntityManager,
		params: CustomerMachineParams,
		coLockedMachineIds: readonly string[] = [],
		expectedPriceCardId?: string
	): Promise<ReservedMachine> {
		if (params.placement.kind === PlacementKind.PINNED) {
			return this.reservePinned(
				manager,
				params,
				params.placement.machineId,
				coLockedMachineIds,
				expectedPriceCardId
			);
		}
		return this.reserveAvailable(manager, params, coLockedMachineIds);
	}

	async reserveAvailable(
		manager: EntityManager,
		params: CustomerMachineParams,
		coLockedMachineIds: readonly string[] = []
	): Promise<ReservedMachine> {
		let restriction: BillingRestrictedException | null = null;
		for (const gpuType of gpuTypePreferences(params)) {
			const preference = { ...params, gpuType };
			const ranked = await this.machines.rank(preference, manager);
			const admission = await this.capacity.admit(
				manager,
				params.customerOrganizationId,
				ranked
			);
			restriction ??= admission.restriction;
			for (const candidate of admission.admitted) {
				const outcome = await this.attempt(
					manager,
					candidate.machineId,
					preference,
					coLockedMachineIds
				);
				if (!(outcome instanceof ReservationRejectedError)) return outcome;
				restriction ??= outcome.restriction;
			}
		}
		throw restriction ?? new NoAvailableMachineError(params);
	}

	async reserveSpecific(
		manager: EntityManager,
		machineId: string,
		params: CustomerMachineParams,
		coLockedMachineIds: readonly string[] = []
	): Promise<ReservedMachine | null> {
		const outcome = await this.attempt(
			manager,
			machineId,
			params,
			coLockedMachineIds
		);
		return outcome instanceof ReservationRejectedError ? null : outcome;
	}

	private async reservePinned(
		manager: EntityManager,
		params: CustomerMachineParams,
		machineId: string,
		coLockedMachineIds: readonly string[],
		expectedPriceCardId: string | undefined
	): Promise<ReservedMachine> {
		try {
			const outcome = await this.attempt(
				manager,
				machineId,
				params,
				coLockedMachineIds,
				expectedPriceCardId
			);
			if (!(outcome instanceof ReservationRejectedError)) return outcome;
			if (outcome.restriction) throw outcome.restriction;
		} catch (error) {
			if (!(error instanceof PriceChangedError)) throw error;
			throw new ConflictException({
				code: SandboxPlacementErrorCode.PRICE_CHANGED,
				message: 'The machine price changed since it was quoted',
				quote: await this.quotes.quoteCandidate(
					manager,
					params,
					error.candidate,
					1
				),
			});
		}
		throw await this.availability.unavailable(manager, params, machineId);
	}

	private async attempt(
		manager: EntityManager,
		machineId: string,
		params: CustomerMachineParams,
		coLockedMachineIds: readonly string[],
		expectedPriceCardId?: string
	): Promise<ReservedMachine | ReservationRejectedError> {
		if (!manager.isInTransaction()) {
			throw new Error(
				'A Machine reservation must run inside the transaction that uses it'
			);
		}
		try {
			return await manager.transactional(
				(savepoint) =>
					this.lockQualifiedMachine(
						savepoint,
						machineId,
						params,
						coLockedMachineIds,
						expectedPriceCardId
					),
				{ propagation: TransactionPropagation.NESTED, clear: true }
			);
		} catch (error) {
			if (!(error instanceof ReservationRejectedError)) throw error;
			this.logger.debug(
				`Machine ${machineId} rejected for reservation: ${error.reason}`
			);
			return error;
		}
	}

	private async lockQualifiedMachine(
		manager: EntityManager,
		machineId: string,
		params: CustomerMachineParams,
		coLockedMachineIds: readonly string[],
		expectedPriceCardId: string | undefined
	): Promise<ReservedMachine> {
		const locked = await lockMachinesForUpdate(manager, [
			machineId,
			...coLockedMachineIds,
		]);
		const machine = locked.find(({ id }) => id === machineId);
		if (!machine) {
			throw new ReservationRejectedError(RESERVATION_REJECTION.MACHINE_MISSING);
		}
		const listing = await manager.findOne(
			MachineListing,
			{ machineId: machineId },
			{ lockMode: LockMode.PESSIMISTIC_READ }
		);
		if (!listing) {
			throw new ReservationRejectedError(RESERVATION_REJECTION.LISTING_MISSING);
		}
		const [candidate] = await this.machines.eligibleMachines(params, manager, [
			machineId,
		]);
		if (!candidate) {
			throw new ReservationRejectedError(RESERVATION_REJECTION.INELIGIBLE);
		}
		if (
			expectedPriceCardId !== undefined &&
			!candidate.selfUse &&
			candidate.priceCardId !== expectedPriceCardId
		) {
			throw new PriceChangedError(candidate);
		}
		try {
			await this.capacity.assertAdmissible(manager, {
				customerOrganizationId: params.customerOrganizationId,
				machine,
				hourlyGrossMicroUsd: candidate.hourlyGrossMicroUsd,
			});
		} catch (error) {
			if (!(error instanceof HttpException)) throw error;
			throw new ReservationRejectedError(
				RESERVATION_REJECTION.CAPACITY,
				error instanceof BillingRestrictedException ? error : null
			);
		}
		return { machine, locality: candidate.locality };
	}
}

function gpuTypePreferences(
	params: CustomerMachineParams
): CustomerMachineParams['gpuType'][] {
	return params.gpu > 0 && Array.isArray(params.gpuType)
		? params.gpuType
		: [params.gpuType];
}
