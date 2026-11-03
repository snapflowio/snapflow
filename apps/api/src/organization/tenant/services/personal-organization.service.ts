/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomUUID } from 'node:crypto';
import { TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import {
	ORGANIZATION_ROLE,
	PERSONAL_ORGANIZATION_SLUG_PREFIX,
} from '@snapflow/organization-access';
import { ORGANIZATION_CREATION_LOCK_NAMESPACE } from '../../../common/constants/advisory-lock.constants';
import { lockAdvisoryKey } from '../../../infra/database/utils/advisory-lock.util';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { User } from '../../../user/entities/user.entity';
import { SystemRole } from '../../../user/enums/system-role.enum';
import { PERSONAL_ORGANIZATION_NAME } from '../constants/organization.constants';
import { ORGANIZATION_SUSPENSION_REASON } from '../constants/organization-suspension.constants';
import { Member } from '../entities/member.entity';
import { Organization } from '../entities/organization.entity';
import { OrganizationQuotaService } from './organization-quota.service';

const PERSONAL_ORGANIZATION = { personal: true, deletedAt: null } as const;

@Injectable()
export class PersonalOrganizationService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly quotas: OrganizationQuotaService
	) {}

	ensure(userId: string): Promise<Organization> {
		return this.entityManager.transactional(
			async (manager) => {
				await lockAdvisoryKey(
					manager,
					userId,
					ORGANIZATION_CREATION_LOCK_NAMESPACE
				);
				return (
					(await manager.findOne(Organization, {
						...PERSONAL_ORGANIZATION,
						createdBy: userId,
					})) ?? (await this.create(manager, userId))
				);
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	find(userId: string): Promise<Organization | null> {
		return this.entityManager.fork().findOne(Organization, {
			...PERSONAL_ORGANIZATION,
			createdBy: userId,
		});
	}

	async liftEmailVerificationSuspension(userId: string): Promise<void> {
		await this.entityManager.transactional(
			(manager) =>
				manager.nativeUpdate(
					Organization,
					{
						...PERSONAL_ORGANIZATION,
						createdBy: userId,
						suspensionReason: ORGANIZATION_SUSPENSION_REASON.EMAIL_UNVERIFIED,
					},
					{
						suspended: false,
						suspendedAt: null,
						suspendedUntil: null,
						suspensionReason: null,
					}
				),
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	private async create(
		manager: EntityManager,
		userId: string
	): Promise<Organization> {
		const user = await manager.findOneOrFail(
			User,
			{ id: userId },
			{ fields: ['emailVerified', 'role'] }
		);
		const awaitingVerification =
			!user.emailVerified && user.role !== SystemRole.ADMIN;
		const organization = manager.create(Organization, {
			id: randomUUID(),
			name: PERSONAL_ORGANIZATION_NAME,
			slug: `${PERSONAL_ORGANIZATION_SLUG_PREFIX}${userId}`,
			personal: true,
			createdBy: userId,
			suspended: awaitingVerification,
			suspendedAt: awaitingVerification ? await databaseNow(manager) : null,
			suspensionReason: awaitingVerification
				? ORGANIZATION_SUSPENSION_REASON.EMAIL_UNVERIFIED
				: null,
		});
		manager.create(Member, {
			id: randomUUID(),
			organizationId: organization.id,
			userId,
			role: ORGANIZATION_ROLE.OWNER,
		});
		await manager.flush();
		await this.quotas.assignPlatformDefaults(organization.id, manager);
		return organization;
	}
}
