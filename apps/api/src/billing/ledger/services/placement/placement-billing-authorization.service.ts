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
import { ConflictException, Injectable } from '@nestjs/common';
import { addMinutes } from '../../../../common/utils/time.util';
import { MicroUsd } from '../../../../common/values/micro-usd.value';
import { databaseNow } from '../../../../infra/database/utils/database-time.util';
import { Sandbox } from '../../../../sandbox/instance/entities/sandbox.entity';
import { SandboxPlacement } from '../../../../sandbox/instance/entities/sandbox-placement.entity';
import { SandboxDesiredState } from '../../../../sandbox/instance/enums/sandbox-desired-state.enum';
import { Machine } from '../../../../sandbox/machine/entities/machine.entity';
import { PlacementFundingState } from '../../constants/billing.constants';
import {
	BillingAdmissionErrorCode,
	PLACEMENT_AUTHORIZATION_CREATED_BY,
} from '../../constants/billing-admission.constants';
import { BILLING_POLICY } from '../../constants/billing-policy.constants';
import { PlacementBillingAuthorization } from '../../entities/placement-billing-authorization.entity';
import {
	findActiveAuthorization,
	lockParticipants,
	trustedAssessment,
} from '../../utils/placement-admission.util';
import { PlacementBillingCapacityService } from './placement-billing-capacity.service';

@Injectable()
export class PlacementBillingAuthorizationService {
	constructor(private readonly capacity: PlacementBillingCapacityService) {}

	async authorize(
		manager: EntityManager,
		placement: SandboxPlacement,
		sandbox: Sandbox,
		machine: Machine,
		leaseId: string,
		estimatedHourlyMicroUsd: MicroUsd,
		observedAt?: Date
	): Promise<PlacementBillingAuthorization> {
		const hostOrganizationId = await lockParticipants(
			manager,
			sandbox,
			machine
		);
		const now = observedAt ?? (await databaseNow(manager));
		const assessment = await trustedAssessment(
			manager,
			machine,
			LockMode.PESSIMISTIC_WRITE
		);
		const reservation = await this.capacity.runwayReservation(
			manager,
			sandbox.organizationId,
			estimatedHourlyMicroUsd,
			now
		);
		const starting = sandbox.desiredState === SandboxDesiredState.STARTED;
		const requestedMicroUsd = starting
			? reservation.totalMicroUsd
			: MicroUsd.ZERO;
		await this.capacity.assertCapacity(manager, {
			customerOrganizationId: sandbox.organizationId,
			machine,
			hostOrganizationId,
			assessment,
			requestedMicroUsd,
			networkRequestedMicroUsd: starting
				? reservation.networkMicroUsd
				: MicroUsd.ZERO,
			observedAt: now,
		});
		const authorization = manager.create(PlacementBillingAuthorization, {
			placementId: placement.id,
			sandboxId: sandbox.id,
			assignmentGeneration: placement.assignmentGeneration,
			customerOrganizationId: sandbox.organizationId,
			hostOrganizationId,
			leaseId,
			estimatedHourlyMicroUsd: estimatedHourlyMicroUsd.toString(),
			reservedMicroUsd: reservation.totalMicroUsd.toString(),
			remainingReservedMicroUsd: requestedMicroUsd.toString(),
			createdBy: PLACEMENT_AUTHORIZATION_CREATED_BY,
			createdAt: now,
			expiresAt: this.reservationExpiry(now),
			fundingState: PlacementFundingState.HEALTHY,
			fundingStateChangedAt: now,
			billingCutoffAt: null,
			releasedAt: null,
		});
		manager.persist(authorization);
		return authorization;
	}

	async renew(
		manager: EntityManager,
		placement: SandboxPlacement,
		sandbox: Sandbox,
		machine: Machine
	): Promise<PlacementBillingAuthorization> {
		const hostOrganizationId = await lockParticipants(
			manager,
			sandbox,
			machine
		);
		const authorization = await manager.findOne(
			PlacementBillingAuthorization,
			{ placementId: placement.id },
			{ lockMode: LockMode.PESSIMISTIC_WRITE }
		);
		if (!authorization || authorization.releasedAt) {
			throw new ConflictException({
				code: BillingAdmissionErrorCode.BILLING_AUTHORIZATION_REQUIRED,
				placementId: placement.id,
			});
		}
		const now = await databaseNow(manager);
		const assessment = await trustedAssessment(
			manager,
			machine,
			LockMode.PESSIMISTIC_READ
		);
		const reservation = await this.capacity.runwayReservation(
			manager,
			sandbox.organizationId,
			MicroUsd.parse(authorization.estimatedHourlyMicroUsd),
			now
		);
		await this.capacity.assertCapacity(manager, {
			customerOrganizationId: sandbox.organizationId,
			machine,
			hostOrganizationId,
			assessment,
			requestedMicroUsd: reservation.totalMicroUsd,
			networkRequestedMicroUsd: reservation.networkMicroUsd,
			observedAt: now,
			renewedPlacementId: placement.id,
		});
		authorization.remainingReservedMicroUsd =
			reservation.totalMicroUsd.toString();
		authorization.reservedMicroUsd = reservation.totalMicroUsd.toString();
		authorization.fundingState = PlacementFundingState.HEALTHY;
		authorization.fundingStateChangedAt = now;
		authorization.billingCutoffAt = null;
		authorization.expiresAt = this.reservationExpiry(now);
		return authorization;
	}

	async attachLease(
		manager: EntityManager,
		placementId: string,
		leaseId: string,
		estimatedHourlyMicroUsd: MicroUsd
	): Promise<void> {
		const authorization = await findActiveAuthorization(manager, placementId);
		if (!authorization) {
			throw new ConflictException({
				code: BillingAdmissionErrorCode.BILLING_AUTHORIZATION_REQUIRED,
				placementId,
			});
		}
		authorization.leaseId = leaseId;
		authorization.estimatedHourlyMicroUsd = estimatedHourlyMicroUsd.toString();
	}

	async markFundingState(
		manager: EntityManager,
		placementId: string,
		state: PlacementFundingState,
		billingCutoffAt: Date | null = null
	): Promise<void> {
		const authorization = await findActiveAuthorization(manager, placementId);
		if (!authorization) return;
		if (
			authorization.fundingState === state &&
			authorization.billingCutoffAt?.getTime() === billingCutoffAt?.getTime()
		) {
			return;
		}
		authorization.fundingState = state;
		authorization.fundingStateChangedAt = await databaseNow(manager);
		authorization.billingCutoffAt = billingCutoffAt;
	}

	async renewForSandbox(
		manager: EntityManager,
		sandbox: Sandbox
	): Promise<PlacementBillingAuthorization> {
		const placement = await manager.findOne(
			SandboxPlacement,
			{ sandboxId: sandbox.id, releasedAt: null },
			{ lockMode: LockMode.PESSIMISTIC_READ }
		);
		if (!placement) {
			throw new ConflictException({
				code: BillingAdmissionErrorCode.BILLING_AUTHORIZATION_REQUIRED,
				sandboxId: sandbox.id,
			});
		}
		const machine = await manager.findOne(Machine, { id: placement.machineId });
		if (!machine) {
			throw new ConflictException({
				code: BillingAdmissionErrorCode.MACHINE_NOT_FOUND,
				machineId: placement.machineId,
			});
		}
		return this.renew(manager, placement, sandbox, machine);
	}

	async release(manager: EntityManager, placementId: string): Promise<void> {
		const authorization = await findActiveAuthorization(manager, placementId);
		if (!authorization) return;
		authorization.remainingReservedMicroUsd = '0';
		authorization.releasedAt = await databaseNow(manager);
	}

	async clearReservation(
		manager: EntityManager,
		placementId: string
	): Promise<void> {
		const authorization = await findActiveAuthorization(manager, placementId);
		if (!authorization) return;
		authorization.remainingReservedMicroUsd = '0';
	}

	private reservationExpiry(now: Date): Date {
		return addMinutes(now, BILLING_POLICY.reservationRenewalMinutes);
	}
}
