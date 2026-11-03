/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { User } from '../../../user/entities/user.entity';
import { ORGANIZATION_CREATION_LIMIT_PER_USER } from '../constants/organization.constants';
import { ORGANIZATION_ERROR } from '../constants/organization-errors.constants';
import { Member } from '../entities/member.entity';
import { Organization } from '../entities/organization.entity';
import { isSuspensionActive } from '../utils/organization-suspension.util';
import { PersonalOrganizationService } from './personal-organization.service';

@Injectable()
export class OrganizationService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly personalOrganizations: PersonalOrganizationService
	) {}

	findOne(organizationId: string): Promise<Organization | null> {
		return this.entityManager.fork().findOne(Organization, {
			id: organizationId,
			deletedAt: null,
		});
	}

	async findOneOrFail(organizationId: string): Promise<Organization> {
		const organization = await this.findOne(organizationId);
		if (!organization) {
			throw new NotFoundException(`Organization ${organizationId} not found`);
		}
		return organization;
	}

	async assertActive(organizationId: string): Promise<Organization> {
		const organization = await this.findOneOrFail(organizationId);
		if (!isSuspensionActive(organization)) return organization;
		throw new ForbiddenException(
			organization.suspensionReason
				? `${ORGANIZATION_ERROR.ORGANIZATION_SUSPENDED.message}: ${organization.suspensionReason}`
				: ORGANIZATION_ERROR.ORGANIZATION_SUSPENDED.message
		);
	}

	findMembership(
		organizationId: string,
		userId: string
	): Promise<Member | null> {
		return this.entityManager
			.fork()
			.findOne(Member, { organizationId, userId });
	}

	async resolveMembership(
		userId: string,
		organizationId: string | null | undefined
	): Promise<Member> {
		const membership = organizationId
			? await this.findMembership(organizationId, userId)
			: null;
		if (membership) return membership;
		const personal = await this.personalOrganizations.ensure(userId);
		const personalMembership = await this.findMembership(personal.id, userId);
		if (!personalMembership) {
			throw new NotFoundException(
				`User ${userId} is not a member of its personal organization`
			);
		}
		return personalMembership;
	}

	async resolveInitialActiveOrganizationId(userId: string): Promise<string> {
		const user = await this.entityManager
			.fork()
			.findOne(User, { id: userId }, { fields: ['lastActiveOrganizationId'] });
		return (
			await this.resolveMembership(userId, user?.lastActiveOrganizationId)
		).organizationId;
	}

	async recordLastActiveOrganization(
		userId: string,
		organizationId: string | null
	): Promise<void> {
		await this.entityManager.transactional(
			(manager) =>
				manager.nativeUpdate(
					User,
					{ id: userId },
					{ lastActiveOrganizationId: organizationId }
				),
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	async hasReachedCreationLimit(userId: string): Promise<boolean> {
		return (
			(await this.entityManager
				.fork()
				.count(Organization, { createdBy: userId, deletedAt: null })) >=
			ORGANIZATION_CREATION_LIMIT_PER_USER
		);
	}
}
