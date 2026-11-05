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
import { ConflictException } from '@nestjs/common';
import { lockRowIdsForKeyShare } from '../../infra/database/utils/row-lock.util';
import { findCurrentMachineAssessment } from '../../marketplace/queries/machine-assessment.query';
import { Organization } from '../../organization/entities/organization.entity';
import type { Sandbox } from '../../sandbox/entities/sandbox.entity';
import type { Machine } from '../../sandbox/machine/entities/machine.entity';
import { MachineAssessment } from '../../sandbox/machine/entities/machine-assessment.entity';
import { BillingAdmissionErrorCode } from '../constants/billing-admission.constants';
import { PlacementBillingAuthorization } from '../entities/placement-billing-authorization.entity';

export async function lockParticipants(
	manager: EntityManager,
	sandbox: Sandbox,
	machine: Machine
): Promise<string> {
	const hostOrganizationId = machine.organizationId;
	const lockedOrganizations = await manager.find(
		Organization,
		{ id: { $in: [sandbox.organizationId, hostOrganizationId] } },
		{ lockMode: LockMode.PESSIMISTIC_WRITE, orderBy: { id: 'ASC' } }
	);
	if (
		!lockedOrganizations.some(
			(organization) => organization.id === hostOrganizationId
		)
	) {
		throw new ConflictException({
			code: BillingAdmissionErrorCode.MACHINE_HOST_NOT_FOUND,
			hostOrganizationId,
		});
	}
	return hostOrganizationId;
}

export async function trustedAssessment(
	manager: EntityManager,
	machine: Machine,
	lockMode: LockMode
): Promise<MachineAssessment> {
	const assessment = await findCurrentMachineAssessment(
		manager,
		machine.id,
		lockMode
	);
	if (!assessment) {
		throw new ConflictException({
			code: BillingAdmissionErrorCode.MACHINE_TRUST_RESTRICTED,
			machineId: machine.id,
		});
	}
	return assessment;
}

export function findActiveAuthorization(
	manager: EntityManager,
	placementId: string
): Promise<PlacementBillingAuthorization | null> {
	return manager.findOne(
		PlacementBillingAuthorization,
		{ placementId, releasedAt: null },
		{ lockMode: LockMode.PESSIMISTIC_WRITE }
	);
}

export async function lockChargedAuthorization(
	manager: EntityManager,
	placementId: string,
	organizationIds: readonly (string | null)[]
): Promise<PlacementBillingAuthorization | null> {
	await lockRowIdsForKeyShare(
		manager,
		Organization,
		organizationIds.filter((id): id is string => id !== null)
	);
	return manager.findOne(
		PlacementBillingAuthorization,
		{ placementId },
		{ lockMode: LockMode.PESSIMISTIC_WRITE }
	);
}
