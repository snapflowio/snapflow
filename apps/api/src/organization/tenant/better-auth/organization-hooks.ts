/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EventEmitter2 } from '@nestjs/event-emitter';
import {
	parseOrganizationRoles,
	RESERVED_ORGANIZATION_SLUG_PREFIXES,
} from '@snapflow/organization-access';
import { APIError } from 'better-auth/api';
import type { OrganizationOptions } from 'better-auth/plugins/organization';
import { ORGANIZATION_ERROR } from '../constants/organization-errors.constants';
import { OrganizationEvents } from '../constants/organization-events.constants';
import type { Organization } from '../entities/organization.entity';
import { OrganizationMembershipChangedEvent } from '../events/organization-membership-changed.event';
import type { OrganizationService } from '../services/organization.service';
import type { OrganizationQuotaService } from '../services/organization-quota.service';
import { countBaseRoles } from '../utils/organization-permissions.util';
import { isSuspensionActive } from '../utils/organization-suspension.util';

type OrganizationHooks = NonNullable<OrganizationOptions['organizationHooks']>;

export interface OrganizationHookDependencies {
	organizations: Pick<OrganizationService, 'findOne'>;
	quotas: Pick<OrganizationQuotaService, 'assignPlatformDefaults'>;
	eventEmitter: EventEmitter2;
}

const SINGLE_BASE_ROLE = 1;

export async function loadOrganization(
	organizations: OrganizationHookDependencies['organizations'],
	organizationId: string
): Promise<Organization> {
	const organization = await organizations.findOne(organizationId);
	if (organization) return organization;
	throw APIError.from('NOT_FOUND', ORGANIZATION_ERROR.ORGANIZATION_NOT_FOUND);
}

export function assertSingleBaseRole(role: string): void {
	if (countBaseRoles(parseOrganizationRoles(role)) === SINGLE_BASE_ROLE) return;
	throw APIError.from('BAD_REQUEST', ORGANIZATION_ERROR.BASE_ROLE_REQUIRED);
}

export function assertNotPersonal(
	organization: Pick<Organization, 'personal'>,
	error: (typeof ORGANIZATION_ERROR)[keyof typeof ORGANIZATION_ERROR]
): void {
	if (organization.personal) throw APIError.from('FORBIDDEN', error);
}

function assertNotSuspended(
	organization: Pick<Organization, 'suspended' | 'suspendedUntil'>
): void {
	if (!isSuspensionActive(organization)) return;
	throw APIError.from('FORBIDDEN', ORGANIZATION_ERROR.ORGANIZATION_SUSPENDED);
}

function assertSlugNotReserved(slug: string | undefined): void {
	if (
		!slug ||
		!RESERVED_ORGANIZATION_SLUG_PREFIXES.some((prefix) =>
			slug.startsWith(prefix)
		)
	) {
		return;
	}
	throw APIError.from(
		'BAD_REQUEST',
		ORGANIZATION_ERROR.ORGANIZATION_SLUG_RESERVED
	);
}

export function createOrganizationHooks(
	dependencies: OrganizationHookDependencies
): OrganizationHooks {
	const { organizations, quotas, eventEmitter } = dependencies;
	const emitMembershipChanged = async (
		organizationId: string,
		userId: string
	): Promise<void> => {
		await eventEmitter.emitAsync(
			OrganizationEvents.MEMBERSHIP_CHANGED,
			new OrganizationMembershipChangedEvent(organizationId, userId)
		);
	};

	return {
		beforeCreateOrganization: async ({ organization, user }) => {
			assertSlugNotReserved(organization.slug);
			return { data: { ...organization, createdBy: user.id } };
		},
		afterCreateOrganization: ({ organization }) =>
			quotas.assignPlatformDefaults(organization.id),
		beforeUpdateOrganization: async ({ organization }) => {
			assertSlugNotReserved(organization.slug);
		},
		beforeAddMember: async ({ organization }) => {
			assertNotPersonal(
				await loadOrganization(organizations, organization.id),
				ORGANIZATION_ERROR.PERSONAL_ORGANIZATION_UNSHARABLE
			);
		},
		beforeCreateInvitation: async ({ invitation, organization }) => {
			const stored = await loadOrganization(organizations, organization.id);
			assertNotPersonal(
				stored,
				ORGANIZATION_ERROR.PERSONAL_ORGANIZATION_UNSHARABLE
			);
			assertNotSuspended(stored);
			assertSingleBaseRole(invitation.role);
		},
		beforeAcceptInvitation: async ({ organization }) => {
			assertNotSuspended(
				await loadOrganization(organizations, organization.id)
			);
		},
		beforeUpdateMemberRole: async ({ organization, newRole }) => {
			assertNotPersonal(
				await loadOrganization(organizations, organization.id),
				ORGANIZATION_ERROR.PERSONAL_ORGANIZATION_ROLE_FIXED
			);
			assertSingleBaseRole(newRole);
		},
		afterAcceptInvitation: ({ member }) =>
			emitMembershipChanged(member.organizationId, member.userId),
		afterRemoveMember: ({ member }) =>
			emitMembershipChanged(member.organizationId, member.userId),
		afterUpdateMemberRole: ({ member }) =>
			emitMembershipChanged(member.organizationId, member.userId),
	};
}
