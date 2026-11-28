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
import { splitMemberRoles } from '#lib/api/organizations/member-roles.ts';
import type { OrganizationMember } from '#lib/api/organizations/members.ts';
import type {
	ResourceListSortAccessors,
	ResourceListSortOption,
} from '#lib/components/resource/resource-list.ts';
import { organizationRoleLabel } from '#lib/utils/organization-roles.ts';
import { relativeTimeLabel } from './relative-time.ts';

const META_SEPARATOR = ' · ';

export type MemberSortColumn = 'user' | 'role' | 'joined';

export const MEMBER_SORT_OPTIONS: readonly ResourceListSortOption<MemberSortColumn>[] =
	[
		{ id: 'user', label: 'User' },
		{ id: 'role', label: 'Role' },
		{ id: 'joined', label: 'Joined on' },
	];

export const MEMBER_SORT_ACCESSORS: ResourceListSortAccessors<
	OrganizationMember,
	MemberSortColumn
> = {
	user: (member) => member.user.name || member.user.email,
	role: (member) =>
		organizationRoleLabel(splitMemberRoles(member.role).baseRole),
	joined: (member) => new Date(member.createdAt).getTime(),
};

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

export function invitationDetail(invitation: OrganizationInvitation): string {
	return [
		`Invited ${relativeTimeLabel(invitation.createdAt)}`,
		invitationRoleLabel(invitation),
	].join(META_SEPARATOR);
}

export function invitationRoleLabel(
	invitation: OrganizationInvitation
): string {
	const roles = parseOrganizationRoles(invitation.role);
	const baseRole = roles.find(isOrganizationBaseRole);
	return organizationRoleLabel(baseRole ?? ORGANIZATION_ROLE.MEMBER);
}
