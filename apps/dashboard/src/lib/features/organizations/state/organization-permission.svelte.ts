/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	ORGANIZATION_ROLE,
	parseOrganizationRoles,
} from '@snapflow/organization-access';
import { createQuery } from '@tanstack/svelte-query';
import { createContext } from 'svelte';
import { fromStore } from 'svelte/store';
import {
	activeMemberStore,
	checkStaticRolePermission,
} from '#lib/api/auth/organization.ts';
import { organizationRolesQueryOptions } from '#lib/api/organizations/roles.ts';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';
import {
	hasCustomRoles,
	memberGrantsPermission,
	type OrganizationPermission as OrganizationPermissionGrant,
	type StaticRoleCheck,
} from '#lib/features/organizations/lib/organization-permission.ts';

const staticRoleCheck: StaticRoleCheck = (role, permissions) =>
	checkStaticRolePermission({ role, permissions });

export class OrganizationPermission {
	readonly #auth = getAuth();
	readonly #activeMember = fromStore(activeMemberStore());
	readonly member = $derived(this.#activeMember.current.data ?? null);
	readonly #memberRole = $derived(this.member?.role ?? '');
	readonly isOwner = $derived(
		parseOrganizationRoles(this.#memberRole).includes(ORGANIZATION_ROLE.OWNER)
	);
	readonly #customRoles = createQuery(() => ({
		...organizationRolesQueryOptions(this.#auth.activeOrganizationId ?? ''),
		enabled:
			hasCustomRoles(this.#memberRole) &&
			this.#auth.activeOrganizationId !== null,
	}));
	readonly isPending = $derived(
		this.#activeMember.current.isPending || this.#customRoles.isLoading
	);

	can = (permission: OrganizationPermissionGrant): boolean =>
		memberGrantsPermission(
			{
				customRoles: this.#customRoles.data ?? [],
				memberRole: this.#memberRole,
				staticRoleCheck,
			},
			permission
		);
}

export const [getOrganizationPermission, setOrganizationPermission] =
	createContext<OrganizationPermission>();
