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
import { leasePriceTerms } from '../../../billing/ledger/queries/lease-price.query';
import { PlacementBillingAuthorizationService } from '../../../billing/ledger/services/placement/placement-billing-authorization.service';
import { leaseShape } from '../../../billing/ledger/utils/lease-pricing.util';
import { lockParticipants } from '../../../billing/ledger/utils/placement-admission.util';
import { SANDBOX_PLACEMENT_LOCK_NAMESPACE } from '../../../common/constants/advisory-lock.constants';
import type { MicroUsd } from '../../../common/values/micro-usd.value';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { lockRowsForNoKeyUpdate } from '../../../infra/database/utils/row-lock.util';
import type { SandboxLease } from '../../../marketplace/machine/entities/sandbox-lease.entity';
import { LeaseEndReason } from '../../../marketplace/machine/enums/lease-end-reason.enum';
import { LeaseTermsUnavailableError } from '../../../marketplace/machine/exceptions/lease-terms-unavailable.exception';
import { findCurrentMachineAssessment } from '../../../marketplace/machine/queries/machine-assessment.query';
import { SandboxLeaseService } from '../../../marketplace/machine/services/sandbox-lease.service';
import {
	egressPricePerGiB,
	runningHourlyPrice,
} from '../../../marketplace/machine/utils/pricing.util';
import { Sandbox } from '../../instance/entities/sandbox.entity';
import { SandboxPlacement } from '../../instance/entities/sandbox-placement.entity';
import type { PlacementLocality } from '../../instance/enums/placement-locality.enum';
import { Machine } from '../../machine/entities/machine.entity';
import { lockMachinesForUpdate } from '../../machine/utils/machine-lock.util';
import { placementMachineId } from '../utils/placement-assignment.util';
import {
	leaseEndReason,
	placementReleaseReason,
} from '../utils/placement-release.util';
import { MachineAvailabilityService } from './machine-availability.service';

export interface SynchronizePlacementOptions {
	replacePlacement?: boolean;
	renewBillingAuthorization?: boolean;
	revisedMachineIds?: readonly string[];
	locality?: PlacementLocality;
	leaseEndReason?: LeaseEndReason;
}

interface PlacementRelease {
	assignedMachineId: string | null;
	leaseEndReason?: LeaseEndReason;
	observedAt: Date;
}

interface PlacementOpening {
	assignedMachineId: string;
	locality?: PlacementLocality;
	observedAt: Date;
}

const MAXIMUM_ASSIGNMENT_GENERATION_SQL = `SELECT COALESCE(MAX("assignmentGeneration"), 0) AS maximum
	FROM "sandbox_placement"
	WHERE "sandboxId" = ?`;

@Injectable()
export class SandboxPlacementService {
	constructor(
		private readonly billingAuthorizations: PlacementBillingAuthorizationService,
		private readonly leases: SandboxLeaseService,
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
				leaseEndReason: options.leaseEndReason,
				observedAt,
			});
		}
		if (!assignedMachineId) return null;
		return this.openNext(manager, sandbox, machine, {
			assignedMachineId,
			locality: options.locality,
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
		await this.endLease(
			manager,
			sandbox.id,
			release.leaseEndReason ?? leaseEndReason(releaseReason)
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
				'Machine assignment has no qualified machine'
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
			placedAt: next.observedAt,
			releasedAt: null,
			releaseReason: null,
		});
		manager.persist(placement);
		await manager.flush();
		const lease = await this.openLease(manager, sandbox, placement, machine);
		await this.billingAuthorizations.authorize(
			manager,
			placement,
			sandbox,
			machine,
			lease.id,
			await this.hourlyGross(manager, lease),
			next.observedAt
		);
		return placement;
	}

	private async openLease(
		manager: EntityManager,
		sandbox: Sandbox,
		placement: SandboxPlacement,
		machine: Machine
	): Promise<SandboxLease> {
		try {
			return await this.leases.open(manager, { sandbox, placement, machine });
		} catch (error) {
			if (error instanceof LeaseTermsUnavailableError) {
				throw await this.availability.leaseUnavailable(manager, sandbox, error);
			}
			throw error;
		}
	}

	async hourlyGross(
		manager: EntityManager,
		lease: SandboxLease
	): Promise<MicroUsd> {
		return runningHourlyPrice(
			await leasePriceTerms(manager, lease),
			leaseShape(lease)
		).grossMicroUsd;
	}

	async egressGross(
		manager: EntityManager,
		lease: SandboxLease
	): Promise<MicroUsd> {
		return egressPricePerGiB(await leasePriceTerms(manager, lease))
			.grossMicroUsd;
	}

	private async endLease(
		manager: EntityManager,
		sandboxId: string,
		reason: LeaseEndReason
	): Promise<void> {
		const lease = await this.leases.current(manager, sandboxId);
		if (lease) await this.leases.end(manager, lease.id, reason);
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
