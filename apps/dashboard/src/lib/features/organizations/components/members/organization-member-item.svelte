<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Copy from '@lucide/svelte/icons/copy';
import LogOut from '@lucide/svelte/icons/log-out';
import Pencil from '@lucide/svelte/icons/pencil';
import UserMinus from '@lucide/svelte/icons/user-minus';
import type { OrganizationBaseRole } from '@snapflow/organization-access';
import { splitMemberRoles } from '#lib/api/organizations/member-roles.ts';
import type { OrganizationMember } from '#lib/api/organizations/members.ts';
import ChipDropdown from '#lib/components/ui/chip/chip-dropdown.svelte';
import ChipTag from '#lib/components/ui/chip/chip-tag.svelte';
import MemberRow from '#lib/features/organizations/components/members/member-row.svelte';
import RowActionsMenu from '#lib/features/organizations/components/settings/row-actions-menu.svelte';
import { memberStatus } from '#lib/features/organizations/lib/members-page.ts';
import type { MembersPage } from '#lib/features/organizations/state/members-page.svelte.ts';
import { organizationRoleLabel } from '#lib/utils/organization-roles.ts';

let { page, member }: { page: MembersPage; member: OrganizationMember } =
	$props();

const roles = $derived(splitMemberRoles(member.role));
const self = $derived(member.userId === page.currentUserId);
const editable = $derived(page.editableMember(roles));
</script>

{#snippet roleControl()}
	{#if editable}
		<ChipDropdown
			options={page.baseRoleOptions}
			value={roles.baseRole}
			onChange={(baseRole: OrganizationBaseRole) =>
				page.changeBaseRole(member, roles, baseRole)}
			matchTriggerWidth={false}
			disabled={page.updateRolesMutation.isPending}
			aria-label={`Role of ${member.user.email}`}
		/>
	{:else}
		<ChipTag variant="mono">
			{organizationRoleLabel(roles.baseRole)}
		</ChipTag>
	{/if}
{/snippet}
{#snippet menu()}
	<RowActionsMenu
		label="Member actions"
		actions={[
			{
				icon: Copy,
				label: 'Copy email',
				onSelect: () => page.copyEmail(member.user.email),
			},
			{
				icon: Pencil,
				label: 'Edit roles',
				visible: editable,
				onSelect: () => (page.editing = member),
			},
			{
				icon: UserMinus,
				label: 'Remove',
				destructive: true,
				visible: !self && editable && page.canRemove,
				onSelect: () => (page.removing = member),
			},
			{
				icon: LogOut,
				label: 'Leave organization',
				destructive: true,
				visible: self && !page.personal,
				onSelect: () => (page.leaving = true),
			},
		]}
	/>
{/snippet}
<MemberRow
	name={member.user.name}
	email={member.user.email}
	status={memberStatus(member, roles)}
	{roleControl}
	{menu}
/>
