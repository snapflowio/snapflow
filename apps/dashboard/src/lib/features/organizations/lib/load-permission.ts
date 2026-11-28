/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { QueryClient } from '@tanstack/svelte-query';
import {
	activeMemberRole,
	checkStaticRolePermission,
} from '#lib/api/auth/organization.ts';
import { organizationRolesQueryOptions } from '#lib/api/organizations/roles.ts';
import {
	hasCustomRoles,
	memberGrantsPermission,
	type OrganizationPermission,
} from './organization-permission.ts';

export async function loadOrganizationPermission(
	queryClient: QueryClient,
	organizationId: string | null,
	permission: OrganizationPermission
): Promise<boolean> {
	const memberRole = await activeMemberRole();
	const customRoles =
		organizationId && hasCustomRoles(memberRole)
			? await queryClient.query(organizationRolesQueryOptions(organizationId))
			: [];
	return memberGrantsPermission(
		{
			customRoles,
			memberRole,
			staticRoleCheck: (role, permissions) =>
				checkStaticRolePermission({ role, permissions }),
		},
		permission
	);
}
