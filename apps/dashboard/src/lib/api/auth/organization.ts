/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { mutationOptions } from '@tanstack/svelte-query';
import { authClient } from './client.ts';
import { unwrapAuthResult } from './result.ts';

export type AuthOrganization = typeof authClient.$Infer.Organization;

type RolePermissionCheck = Parameters<
	typeof authClient.organization.checkRolePermission
>[0];

export interface NewOrganization {
	name: string;
	slug: string;
}

export function organizationsStore(): ReturnType<
	typeof authClient.useListOrganizations
> {
	return authClient.useListOrganizations();
}

export function activeOrganizationStore(): ReturnType<
	typeof authClient.useActiveOrganization
> {
	return authClient.useActiveOrganization();
}

export function activeMemberStore(): ReturnType<
	typeof authClient.useActiveMember
> {
	return authClient.useActiveMember();
}

export function checkStaticRolePermission(check: RolePermissionCheck): boolean {
	return authClient.organization.checkRolePermission(check);
}

export function createOrganizationMutationOptions() {
	return mutationOptions({
		mutationFn: async ({ name, slug }: NewOrganization) =>
			unwrapAuthResult(
				await authClient.organization.create({
					name: name.trim(),
					slug: slug.trim(),
					keepCurrentActiveOrganization: false,
				})
			),
		meta: {
			success: 'Organization created',
			failure: 'Failed to create organization',
		},
	});
}

export function setActiveOrganizationMutationOptions() {
	return mutationOptions({
		mutationFn: async (organizationId: string) =>
			unwrapAuthResult(
				await authClient.organization.setActive({ organizationId })
			),
		meta: { failure: 'Failed to switch organization' },
	});
}
