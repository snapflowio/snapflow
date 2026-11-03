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
import type { OrganizationCustomRole } from '#lib/api/organizations/roles.ts';
import { formatPermissions } from '#lib/features/organizations/lib/organization-resources.ts';
import { ORGANIZATION_ROLE_LABEL } from '#lib/utils/organization-roles.ts';

interface BuiltInRole {
	id: string;
	label: string;
	permissions: string;
}

const BUILT_IN_ROLES: readonly BuiltInRole[] = Object.entries(
	ORGANIZATION_ROLES
).flatMap(([name, role]) =>
	isStaticOrganizationRole(name)
		? [
				{
					id: name,
					label: ORGANIZATION_ROLE_LABEL[name],
					permissions: formatPermissions(role.statements) ?? '',
				},
			]
		: []
);

interface RolesSectionProps {
	customRoles: readonly OrganizationCustomRole[];
	loading: boolean;
	failed: boolean;
	retrying: boolean;
	onRetry: () => void;
	canUpdate: boolean;
	canDelete: boolean;
	onEdit: (role: OrganizationCustomRole) => void;
	onDelete: (role: OrganizationCustomRole) => void;
}
</script>

<script lang="ts">
import Pencil from '@lucide/svelte/icons/pencil';
import FeedbackState from '#lib/components/feedback-state.svelte';
import Trash from '#lib/components/icons/trash.svelte';
import SettingsResourceRow from '#lib/components/settings/settings-resource-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import RowActionsMenu from '#lib/features/organizations/components/settings/row-actions-menu.svelte';

let {
	customRoles,
	loading,
	failed,
	retrying,
	onRetry,
	canUpdate,
	canDelete,
	onEdit,
	onDelete,
}: RolesSectionProps = $props();
</script>

{#snippet builtIn()}
	<span class="whitespace-nowrap text-(--text-muted) text-caption"
		>Built-in</span
	>
{/snippet}

<SettingsSection
	title={`Roles (${BUILT_IN_ROLES.length + customRoles.length})`}
>
	<div class="flex flex-col gap-y-0.5">
		{#each BUILT_IN_ROLES as role (role.id)}
			<SettingsResourceRow
				title={role.label}
				description={role.permissions}
				badge={builtIn}
			/>
		{/each}
		{#each customRoles as role (role.id)}
			{#snippet trailing()}
				<div class="shrink-0">
					<RowActionsMenu
						label="Role actions"
						actions={[
							{
								icon: Pencil,
								label: 'Edit',
								visible: canUpdate,
								onSelect: () => onEdit(role),
							},
							{
								icon: Trash,
								label: 'Delete',
								destructive: true,
								disabled: !canDelete,
								onSelect: () => onDelete(role),
							},
						]}
					/>
				</div>
			{/snippet}
			<SettingsResourceRow
				title={role.role}
				description={role.description ||
					formatPermissions(role.permission) ||
					undefined}
				{trailing}
			/>
		{/each}
	</div>
	{#if failed}
		<FeedbackState variant="inline" tone="error" {retrying} {onRetry}>
			Failed to load custom roles
		</FeedbackState>
	{:else if loading}
		<FeedbackState variant="inline">Loading roles...</FeedbackState>
	{/if}
</SettingsSection>
