/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomUUID } from 'node:crypto';
import type { EntityManager } from '@mikro-orm/postgresql';
import { ConflictException, Injectable } from '@nestjs/common';
import { storedPriceTerms } from '../../billing/queries/placement-price.query';
import { PlacementBillingAuthorizationService } from '../../billing/services/placement/placement-billing-authorization.service';
import { lockParticipants } from '../../billing/utils/placement/placement-admission.util';
import { priceShape } from '../../billing/utils/placement-pricing.util';
import { SANDBOX_PLACEMENT_LOCK_NAMESPACE } from '../../common/constants/advisory-lock.constants';
import { apiError } from '../../common/utils/error/api-error.util';
import type { MicroUsd } from '../../common/values/micro-usd.value';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { lockRowsForNoKeyUpdate } from '../../infra/database/utils/row-lock.util';
import { Machine } from '../../machine/entities/machine.entity';
import { lockMachinesForUpdate } from '../../machine/utils/machine-lock.util';
import type { PlacementPrice } from '../../marketplace/entities/placement-price.entity';
import { PriceEndReason } from '../../marketplace/enums/price-end-reason.enum';
import { PriceTermsUnavailableError } from '../../marketplace/exceptions/price-terms-unavailable.exception';
import { findCurrentMachineAssessment } from '../../marketplace/queries/machine-assessment.query';
import { PlacementPriceService } from '../../marketplace/services/placement-price.service';
import { runningHourlyPrice } from '../../marketplace/utils/pricing/pricing.util';
import { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { SandboxPlacement } from '../../sandbox/entities/sandbox-placement.entity';
import type { PlacementLocality } from '../../sandbox/enums/placement-locality.enum';
import { PlacementErrorCode } from '../enums/placement-error-code.enum';
import { placementMachineId } from '../utils/placement-assignment.util';
import {
	placementReleaseReason,
	priceEndReason,
} from '../utils/placement-release.util';
import { MachineAvailabilityService } from './machine-availability.service';

export interface SynchronizePlacementOptions {
	replacePlacement?: boolean;
	renewBillingAuthorization?: boolean;
	revisedMachineIds?: readonly string[];
	locality?: PlacementLocality;
	priceEndReason?: PriceEndReason;
	restoreFromBackup?: string;
}

interface PlacementRelease {
	assignedMachineId: string | null;
	priceEndReason?: PriceEndReason;
	observedAt: Date;
}

interface PlacementOpening {
	assignedMachineId: string;
	locality?: PlacementLocality;
	restoreFromBackup?: string;
	observedAt: Date;
}

const MAXIMUM_ASSIGNMENT_GENERATION_SQL = `SELECT COALESCE(MAX("assignmentGeneration"), 0) AS maximum
	FROM "sandbox_placement"
	WHERE "sandboxId" = ?`;

@Injectable()
export class SandboxPlacementService {
	constructor(
		private readonly billingAuthorizations: PlacementBillingAuthorizationService,
		private readonly placementPrices: PlacementPriceService,
		private readonly availability: MachineAvailabilityService
	) {}

	async lockPlacement(
		manager: EntityManager,
		sandboxId: string
	): Promise<void> {
		await manager.execute(
			'SELECT pg_advisory_xact_lock(hashtextextended(?, ?))',
			[sandboxId, SANDBOX_PLACEMENT_LOCK_NAMESPACE]
		);
	}

	async synchronizeAssignment(
		manager: EntityManager,
		sandbox: Sandbox,
		options: SynchronizePlacementOptions = {}
	): Promise<SandboxPlacement | null> {
		const assignedMachineId = placementMachineId(sandbox);
		await this.lockPlacement(manager, sandbox.id);
		const machines = await lockMachinesForUpdate(manager, [
			...(assignedMachineId ? [assignedMachineId] : []),
			...(options.revisedMachineIds ?? []),
		]);
		const machine = machines.find(({ id }) => id === assignedMachineId) ?? null;
		const current = await this.lockActivePlacement(manager, sandbox.id);
		if (current?.machineId === assignedMachineId && !options.replacePlacement) {
			if (options.renewBillingAuthorization && machine) {
				await this.billingAuthorizations.renew(
					manager,
					current,
					sandbox,
					machine
				);
			}
			return current;
		}
		if (!current && !assignedMachineId) return null;
		const observedAt = await databaseNow(manager);
		if (current) {
			await this.releaseCurrent(manager, sandbox, current, machine, {
				assignedMachineId,
				priceEndReason: options.priceEndReason,
				observedAt,
			});
		}
		if (!assignedMachineId) return null;
		return this.openNext(manager, sandbox, machine, {
			assignedMachineId,
			locality: options.locality,
			restoreFromBackup: options.restoreFromBackup,
			observedAt,
		});
	}

	private async releaseCurrent(
		manager: EntityManager,
		sandbox: Sandbox,
		current: SandboxPlacement,
		machine: Machine | null,
		release: PlacementRelease
	): Promise<void> {
		if (machine) await lockParticipants(manager, sandbox, machine);
		const releaseReason = placementReleaseReason(
			sandbox.state,
			current.machineId,
			release.assignedMachineId
		);
		current.releasedAt = release.observedAt;
		current.releaseReason = releaseReason;
		await this.billingAuthorizations.release(manager, current.id);
		await this.endPrice(
			manager,
			sandbox.id,
			release.priceEndReason ?? priceEndReason(releaseReason)
		);
		if (release.assignedMachineId) {
			await manager.flush();
		}
	}

	private async openNext(
		manager: EntityManager,
		sandbox: Sandbox,
		machine: Machine | null,
		next: PlacementOpening
	): Promise<SandboxPlacement> {
		const assessment = await findCurrentMachineAssessment(
			manager,
			next.assignedMachineId
		);
		if (!machine || !assessment) {
			throw new ConflictException(
				apiError(
					PlacementErrorCode.MACHINE_NOT_QUALIFIED,
					'The assigned machine is no longer qualified to run sandboxes. Try again to place the sandbox on another machine.'
				)
			);
		}
		const generationRows = await manager.execute<{ maximum: string }[]>(
			MAXIMUM_ASSIGNMENT_GENERATION_SQL,
			[sandbox.id]
		);
		const placement = manager.create(SandboxPlacement, {
			id: randomUUID(),
			sandboxId: sandbox.id,
			machineId: next.assignedMachineId,
			assignmentGeneration:
				Number.parseInt(generationRows[0]?.maximum ?? '0', 10) + 1,
			fencingToken: randomUUID(),
			placementKind: sandbox.placementKind,
			locality: next.locality ?? null,
			restoreFromBackup: next.restoreFromBackup ?? null,
			placedAt: next.observedAt,
			releasedAt: null,
			releaseReason: null,
		});
		manager.persist(placement);
		await manager.flush();
		const placementPrice = await this.openPrice(
			manager,
			sandbox,
			placement,
			machine
		);
		await this.billingAuthorizations.authorize(
			manager,
			placement,
			sandbox,
			machine,
			placementPrice.id,
			await this.hourlyGross(manager, placementPrice),
			next.observedAt
		);
		return placement;
	}

	private async openPrice(
		manager: EntityManager,
		sandbox: Sandbox,
		placement: SandboxPlacement,
		machine: Machine
	): Promise<PlacementPrice> {
		try {
			return await this.placementPrices.open(manager, {
				sandbox,
				placement,
				machine,
			});
		} catch (error) {
			if (error instanceof PriceTermsUnavailableError) {
				throw await this.availability.priceUnavailable(manager, sandbox, error);
			}
			throw error;
		}
	}

	async hourlyGross(
		manager: EntityManager,
		placementPrice: PlacementPrice
	): Promise<MicroUsd> {
		return runningHourlyPrice(
			await storedPriceTerms(manager, placementPrice),
			priceShape(placementPrice)
		).grossMicroUsd;
	}

	private async endPrice(
		manager: EntityManager,
		sandboxId: string,
		reason: PriceEndReason
	): Promise<void> {
		const placementPrice = await this.placementPrices.current(
			manager,
			sandboxId
		);
		if (placementPrice)
			await this.placementPrices.end(manager, placementPrice.id, reason);
	}

	private async lockActivePlacement(
		manager: EntityManager,
		sandboxId: string
	): Promise<SandboxPlacement | null> {
		const active = { sandboxId, releasedAt: null };
		const planned = await manager.findOne(SandboxPlacement, active, {
			fields: ['id'],
			disableIdentityMap: true,
		});
		const [current = null] = await lockRowsForNoKeyUpdate(
			manager,
			SandboxPlacement,
			planned ? [planned.id] : [],
			active
		);
		return current;
	}
}
