/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	isOrganizationBaseRole,
	ORGANIZATION_ROLE,
	parseOrganizationRoles,
} from '@snapflow/organization-access';
import * as z from 'zod';
import type { OrganizationInvitation } from '#lib/api/organizations/invitations.ts';
import type { MemberRoles } from '#lib/api/organizations/member-roles.ts';
import type { OrganizationMember } from '#lib/api/organizations/members.ts';
import { formatDate } from '#lib/utils/format.ts';
import {
	formatOrganizationRoles,
	organizationRoleLabel,
} from '#lib/utils/organization-roles.ts';

export const membersSearchSchema = z.object({ search: z.string().catch('') });

export function matchesMember(
	member: OrganizationMember,
	search: string
): boolean {
	return (
		!search ||
		member.user.name.toLowerCase().includes(search) ||
		member.user.email.toLowerCase().includes(search)
	);
}

export function matchesInvitation(
	invitation: OrganizationInvitation,
	search: string
): boolean {
	return !search || invitation.email.toLowerCase().includes(search);
}

export function memberStatus(
	member: OrganizationMember,
	roles: MemberRoles
): string {
	const joined = `Joined ${formatDate(member.createdAt)}`;
	return roles.additionalRoles.length > 0
		? `${formatOrganizationRoles(roles.additionalRoles)} · ${joined}`
		: joined;
}

export function invitationRoleLabel(
	invitation: OrganizationInvitation
): string {
	const roles = parseOrganizationRoles(invitation.role);
	const baseRole = roles.find(isOrganizationBaseRole);
	return organizationRoleLabel(baseRole ?? ORGANIZATION_ROLE.MEMBER);
}
