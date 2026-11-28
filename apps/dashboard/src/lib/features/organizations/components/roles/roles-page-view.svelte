<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import {
	isStaticOrganizationRole,
	ORGANIZATION_ROLES,
} from '@snapflow/organization-access';
import {
	formatPermissionAreas,
	permissionScopes,
	type ScopeResource,
} from '#lib/features/organizations/lib/organization-resources.ts';
import { ORGANIZATION_ROLE_LABEL } from '#lib/utils/organization-roles.ts';

interface BuiltInRole {
	id: string;
	label: string;
	summary: string | null;
	scopes: readonly ScopeResource[];
}

const BUILT_IN_ROLES: readonly BuiltInRole[] = Object.entries(
	ORGANIZATION_ROLES
).flatMap(([name, role]) =>
	isStaticOrganizationRole(name)
		? [
				{
					id: name,
					label: ORGANIZATION_ROLE_LABEL[name],
					summary: formatPermissionAreas(role.statements),
					scopes: permissionScopes(role.statements),
				},
			]
		: []
);
</script>

<script lang="ts">
import Pencil from '@lucide/svelte/icons/pencil';
import FeedbackState from '#lib/components/feedback-state.svelte';
import Trash from '#lib/components/icons/trash.svelte';
import SettingsPage from '#lib/components/settings/settings-page.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import ChipModalConfirmTarget from '#lib/components/ui/chip-modal/chip-modal-confirm-target.svelte';
import Skeleton, {
	SKELETON_SECTION_ROWS,
} from '#lib/components/ui/skeleton/skeleton.svelte';
import CustomRoleModal from '#lib/features/organizations/components/roles/custom-role-modal.svelte';
import RoleRow from '#lib/features/organizations/components/roles/role-row.svelte';
import SettingsGroupCell from '#lib/features/organizations/components/settings/settings-group-cell.svelte';
import { deleteRoleCopy } from '#lib/features/organizations/lib/member-confirm-copy.ts';
import { RolesPage } from '#lib/features/organizations/state/roles-page.svelte.ts';
import { Path, resolvePath } from '#lib/routing/paths.ts';

const page = new RolesPage();
</script>

<SettingsPage
	title="Roles"
	back={{ label: 'Members', href: resolvePath(Path.MEMBERS) }}
	actions={page.headerActions}
>
	<SettingsSection
		title={`Custom (${page.customRoles.length})`}
		info="Custom roles grant a chosen set of permissions on top of the Member role."
	>
		{#if page.rolesQuery.isPending}
			<SettingsGroupCell>
				<Skeleton class="h-10" repeat={SKELETON_SECTION_ROWS} fade />
			</SettingsGroupCell>
		{:else if page.rolesQuery.isError}
			<FeedbackState
				variant="inline"
				tone="error"
				resource="custom roles"
				error={page.rolesQuery.error}
				retrying={page.rolesQuery.isFetching}
				onRetry={() => void page.rolesQuery.refetch()}
			/>
		{:else}
			{#each page.customRoles as role (role.id)}
				<RoleRow
					title={role.role}
					summary={role.description || formatPermissionAreas(role.permission)}
					scopes={permissionScopes(role.permission)}
					actions={[
						{
							icon: Pencil,
							label: 'Edit',
							visible: page.canUpdate,
							onSelect: () => (page.roleEditor = { role }),
						},
						{
							icon: Trash,
							label: 'Delete',
							destructive: true,
							visible: page.canDelete,
							onSelect: () => (page.deletingRole = role),
						},
					]}
				/>
			{:else}
				<SettingsGroupCell tone="muted">
					You don't have any custom roles yet.
				</SettingsGroupCell>
			{/each}
		{/if}
	</SettingsSection>

	<SettingsSection title={`Built-in (${BUILT_IN_ROLES.length})`}>
		{#each BUILT_IN_ROLES as role (role.id)}
			<RoleRow title={role.label} summary={role.summary} scopes={role.scopes} />
		{/each}
	</SettingsSection>
</SettingsPage>

<CustomRoleModal
	bind:open={() => page.roleEditor !== null, page.closeRoleEditor}
	role={page.roleEditor?.role ?? null}
	onSubmit={page.saveRole}
/>

<ChipModalConfirmTarget
	target={page.deletingRole}
	{...deleteRoleCopy(page.deletingRole)}
	pending={page.deleteRoleMutation.isPending}
	onCancel={() => (page.deletingRole = null)}
	onConfirm={page.removeRole}
/>
