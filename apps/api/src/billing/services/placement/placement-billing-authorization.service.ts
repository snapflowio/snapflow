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
import { MicroUsd } from '../../../common/values/micro-usd.value';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import type { Machine } from '../../../machine/entities/machine.entity';
import type { Sandbox } from '../../../sandbox/entities/sandbox.entity';
import type { SandboxPlacement } from '../../../sandbox/entities/sandbox-placement.entity';
import { SandboxDesiredState } from '../../../sandbox/enums/sandbox-desired-state.enum';
import {
	BillingAdmissionErrorCode,
	PLACEMENT_AUTHORIZATION_CREATED_BY,
} from '../../constants/billing-admission.constants';
import { PlacementBillingAuthorization } from '../../entities/placement-billing-authorization.entity';
import {
	findActiveAuthorization,
	lockParticipants,
	trustedAssessment,
} from '../../utils/placement/placement-admission.util';
import { PlacementBillingCapacityService } from './placement-billing-capacity.service';

@Injectable()
export class PlacementBillingAuthorizationService {
	constructor(private readonly capacity: PlacementBillingCapacityService) {}

	async authorize(
		manager: EntityManager,
		placement: SandboxPlacement,
		sandbox: Sandbox,
		machine: Machine,
		placementPriceId: string,
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
		if (sandbox.desiredState === SandboxDesiredState.STARTED) {
			await this.capacity.assertCapacity(manager, {
				customerOrganizationId: sandbox.organizationId,
				machine,
				hostOrganizationId,
				assessment,
				hourlyGrossMicroUsd: estimatedHourlyMicroUsd,
				observedAt: now,
			});
		}
		const authorization = manager.create(PlacementBillingAuthorization, {
			placementId: placement.id,
			sandboxId: sandbox.id,
			assignmentGeneration: placement.assignmentGeneration,
			customerOrganizationId: sandbox.organizationId,
			hostOrganizationId,
			placementPriceId,
			estimatedHourlyMicroUsd: estimatedHourlyMicroUsd.toString(),
			createdBy: PLACEMENT_AUTHORIZATION_CREATED_BY,
			createdAt: now,
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
		await this.capacity.assertCapacity(manager, {
			customerOrganizationId: sandbox.organizationId,
			machine,
			hostOrganizationId,
			assessment: await trustedAssessment(
				manager,
				machine,
				LockMode.PESSIMISTIC_READ
			),
			hourlyGrossMicroUsd: MicroUsd.parse(
				authorization.estimatedHourlyMicroUsd
			),
			observedAt: await databaseNow(manager),
		});
		return authorization;
	}

	async attachPrice(
		manager: EntityManager,
		placementId: string,
		placementPriceId: string,
		estimatedHourlyMicroUsd: MicroUsd
	): Promise<void> {
		const authorization = await findActiveAuthorization(manager, placementId);
		if (!authorization) {
			throw new ConflictException({
				code: BillingAdmissionErrorCode.BILLING_AUTHORIZATION_REQUIRED,
				placementId,
			});
		}
		authorization.placementPriceId = placementPriceId;
		authorization.estimatedHourlyMicroUsd = estimatedHourlyMicroUsd.toString();
	}

	async release(manager: EntityManager, placementId: string): Promise<void> {
		const authorization = await findActiveAuthorization(manager, placementId);
		if (!authorization) return;
		authorization.releasedAt = await databaseNow(manager);
	}
}
