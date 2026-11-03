/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ORGANIZATION_MEMBERSHIP_LIMIT } from '@snapflow/organization-access';
import { mutationOptions, queryOptions } from '@tanstack/svelte-query';
import { authClient } from '#lib/api/auth/client.ts';
import { unwrapAuthResult } from '#lib/api/auth/result.ts';
import { joinMemberRoles, type MemberRoles } from './member-roles.ts';
import { organizationQueryKeys } from './query-keys.ts';

async function listMembers(organizationId: string) {
	return (
		unwrapAuthResult(
			await authClient.organization.listMembers({
				query: { organizationId, limit: ORGANIZATION_MEMBERSHIP_LIMIT },
			})
		)?.members ?? []
	);
}

export type OrganizationMember = Awaited<
	ReturnType<typeof listMembers>
>[number];

interface MemberRoleChange {
	member: OrganizationMember;
	roles: MemberRoles;
}

export function membersQueryOptions(organizationId: string) {
	return queryOptions({
		queryKey: organizationQueryKeys.members(organizationId),
		queryFn: () => listMembers(organizationId),
		enabled: Boolean(organizationId),
	});
}

export function updateMemberRolesMutationOptions(organizationId: string) {
	return mutationOptions({
		mutationFn: async ({ member, roles }: MemberRoleChange) =>
			unwrapAuthResult(
				await authClient.organization.updateMemberRole({
					organizationId,
					memberId: member.id,
					role: joinMemberRoles(roles),
				})
			),
		meta: {
			invalidates: [organizationQueryKeys.members(organizationId)],
			success: 'Member roles updated',
			failure: 'Failed to update member roles',
		},
	});
}

export function removeMemberMutationOptions(organizationId: string) {
	return mutationOptions({
		mutationFn: async (member: OrganizationMember) =>
			unwrapAuthResult(
				await authClient.organization.removeMember({
					organizationId,
					memberIdOrEmail: member.id,
				})
			),
		meta: {
			invalidates: [organizationQueryKeys.members(organizationId)],
			success: 'Member removed',
			failure: 'Failed to remove member',
		},
	});
}

export function leaveOrganizationMutationOptions(organizationId: string) {
	return mutationOptions({
		mutationFn: async () =>
			unwrapAuthResult(await authClient.organization.leave({ organizationId })),
		meta: { failure: 'Failed to leave organization' },
	});
}
