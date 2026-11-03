/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { mutationOptions, queryOptions } from '@tanstack/svelte-query';
import { authClient } from '#lib/api/auth/client.ts';
import { unwrapAuthResult } from '#lib/api/auth/result.ts';
import { organizationQueryKeys } from './query-keys.ts';

export type PermissionRecord = Record<string, string[]>;

async function listOrganizationRoles(organizationId: string) {
	return (
		unwrapAuthResult(
			await authClient.organization.listRoles({ query: { organizationId } })
		) ?? []
	);
}

export type OrganizationCustomRole = Awaited<
	ReturnType<typeof listOrganizationRoles>
>[number];

export interface CustomRoleInput {
	description: string;
	name: string;
	permission: PermissionRecord;
}

interface CustomRoleUpdate extends CustomRoleInput {
	role: OrganizationCustomRole;
}

export function organizationRolesQueryOptions(organizationId: string) {
	return queryOptions({
		queryKey: organizationQueryKeys.roles(organizationId),
		queryFn: () => listOrganizationRoles(organizationId),
	});
}

export function createRoleMutationOptions(organizationId: string) {
	return mutationOptions({
		mutationFn: async ({ description, name, permission }: CustomRoleInput) =>
			unwrapAuthResult(
				await authClient.organization.createRole({
					organizationId,
					role: name,
					permission,
					additionalFields: { description },
				})
			),
		meta: {
			invalidates: [organizationQueryKeys.roles(organizationId)],
			success: 'Role created',
			failure: 'Failed to create role',
		},
	});
}

export function updateRoleMutationOptions(organizationId: string) {
	return mutationOptions({
		mutationFn: async ({
			description,
			name,
			permission,
			role,
		}: CustomRoleUpdate) =>
			unwrapAuthResult(
				await authClient.organization.updateRole({
					organizationId,
					roleId: role.id,
					data: { roleName: name, permission, description },
				})
			),
		meta: {
			invalidates: [organizationQueryKeys.roles(organizationId)],
			success: 'Role updated',
			failure: 'Failed to update role',
		},
	});
}

export function deleteRoleMutationOptions(organizationId: string) {
	return mutationOptions({
		mutationFn: async (role: OrganizationCustomRole) =>
			unwrapAuthResult(
				await authClient.organization.deleteRole({
					organizationId,
					roleId: role.id,
				})
			),
		meta: {
			invalidates: [organizationQueryKeys.roles(organizationId)],
			success: 'Role deleted',
			failure: 'Failed to delete role',
		},
	});
}
