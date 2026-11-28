/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import Plus from '@lucide/svelte/icons/plus';
import { ORGANIZATION_CUSTOM_ROLE_LIMIT } from '@snapflow/organization-access';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import {
	type CustomRoleInput,
	createRoleMutationOptions,
	deleteRoleMutationOptions,
	type OrganizationCustomRole,
	organizationRolesQueryOptions,
	updateRoleMutationOptions,
} from '#lib/api/organizations/roles.ts';
import type { HeaderAction } from '#lib/components/page/header-actions.ts';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';

const ROLE_LIMIT_REASON = `Organizations can have up to ${ORGANIZATION_CUSTOM_ROLE_LIMIT} custom roles`;
const NO_ROLE_PERMISSION_REASON = 'Needs the Admin or Owner role';

interface RoleEditor {
	role: OrganizationCustomRole | null;
}

export class RolesPage {
	readonly #auth = getAuth();
	readonly #permission = getOrganizationPermission();
	readonly #organizationId = $derived(this.#auth.activeOrganizationId ?? '');
	readonly #createRole = createMutation(() =>
		createRoleMutationOptions(this.#organizationId)
	);
	readonly #updateRole = createMutation(() =>
		updateRoleMutationOptions(this.#organizationId)
	);

	readonly rolesQuery = createQuery(() => ({
		...organizationRolesQueryOptions(this.#organizationId),
		enabled: this.#auth.activeOrganizationId !== null,
	}));
	readonly deleteRoleMutation = createMutation(() =>
		deleteRoleMutationOptions(this.#organizationId)
	);

	roleEditor = $state.raw<RoleEditor | null>(null);
	deletingRole = $state.raw<OrganizationCustomRole | null>(null);

	readonly canUpdate = $derived(this.#permission.can({ ac: ['update'] }));
	readonly canDelete = $derived(this.#permission.can({ ac: ['delete'] }));
	readonly #canCreate = $derived(this.#permission.can({ ac: ['create'] }));
	readonly customRoles = $derived(this.rolesQuery.data ?? []);
	readonly #createDisabledReason = $derived.by(() => {
		if (!this.#canCreate) return NO_ROLE_PERMISSION_REASON;
		if (this.customRoles.length >= ORGANIZATION_CUSTOM_ROLE_LIMIT) {
			return ROLE_LIMIT_REASON;
		}
		return undefined;
	});
	readonly headerActions = $derived.by((): HeaderAction[] => [
		{
			id: 'create-role',
			kind: 'primary',
			label: 'Create role',
			icon: Plus,
			disabled: this.#createDisabledReason !== undefined,
			disabledReason: this.#createDisabledReason,
			onSelect: () => (this.roleEditor = { role: null }),
		},
	]);

	closeRoleEditor = (open: boolean): void => {
		if (!open) this.roleEditor = null;
	};

	saveRole = async (input: CustomRoleInput): Promise<void> => {
		const role = this.roleEditor?.role;
		if (role) await this.#updateRole.mutateAsync({ ...input, role });
		else await this.#createRole.mutateAsync(input);
		this.roleEditor = null;
	};

	removeRole = (role: OrganizationCustomRole): void => {
		this.deleteRoleMutation.mutate(role, {
			onSuccess: () => {
				this.deletingRole = null;
			},
		});
	};
}
