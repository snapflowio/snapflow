<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import {
	ORGANIZATION_BASE_ROLES,
	ORGANIZATION_ROLE,
	type OrganizationBaseRole,
} from '@snapflow/organization-access';
import { createQuery } from '@tanstack/svelte-query';
import { organizationRolesQueryOptions } from '#lib/api/organizations/roles.ts';
import ChipDropdown from '#lib/components/ui/chip/chip-dropdown.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import {
	ORGANIZATION_PRESET_ROLES,
	organizationRoleLabel,
} from '#lib/utils/organization-roles.ts';

interface MemberRoleFieldsProps {
	baseRole: OrganizationBaseRole;
	additionalRoles: string[];
	disabled?: boolean;
}

let {
	baseRole = $bindable(),
	additionalRoles = $bindable(),
	disabled = false,
}: MemberRoleFieldsProps = $props();

const roleId = $props.id();
const additionalId = `${roleId}-additional`;
const auth = getAuth();
const permission = getOrganizationPermission();
const customRolesQuery = createQuery(() => ({
	...organizationRolesQueryOptions(auth.activeOrganizationId ?? ''),
	enabled: auth.activeOrganizationId !== null,
}));
const baseRoleOptions = $derived(
	ORGANIZATION_BASE_ROLES.filter(
		(role) => permission.isOwner || role !== ORGANIZATION_ROLE.OWNER
	).map((role) => ({ label: organizationRoleLabel(role), value: role }))
);
const additionalRoleOptions = $derived(
	[
		...ORGANIZATION_PRESET_ROLES,
		...(customRolesQuery.data ?? []).map((customRole) => customRole.role),
	].map((role) => ({ label: organizationRoleLabel(role), value: role }))
);
</script>

<ChipModalField label="Role" for={roleId}>
	<ChipDropdown
		id={roleId}
		options={baseRoleOptions}
		bind:value={baseRole}
		placeholder="Select role"
		align="start"
		fullWidth
		{disabled}
		aria-label="Role"
	/>
</ChipModalField>
<ChipModalField
	label="Additional roles"
	for={additionalId}
	hint={baseRole === ORGANIZATION_ROLE.MEMBER
		? undefined
		: 'Owners and admins already hold every resource permission.'}
>
	<ChipDropdown
		id={additionalId}
		multiple
		options={additionalRoleOptions}
		bind:value={additionalRoles}
		placeholder="Select roles"
		showAllOption={false}
		searchable
		searchPlaceholder="Search roles..."
		align="start"
		fullWidth
		disabled={disabled || baseRole !== ORGANIZATION_ROLE.MEMBER}
		aria-label="Additional roles"
	/>
</ChipModalField>
