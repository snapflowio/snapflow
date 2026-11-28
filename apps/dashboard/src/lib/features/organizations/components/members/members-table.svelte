<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const USER_COLUMN_GROW = 2;
const JOINED_COLUMN_WIDTH = 160;
</script>

<script lang="ts">
import Copy from '@lucide/svelte/icons/copy';
import History from '@lucide/svelte/icons/history';
import LogOut from '@lucide/svelte/icons/log-out';
import Pencil from '@lucide/svelte/icons/pencil';
import UserMinus from '@lucide/svelte/icons/user-minus';
import { renderSnippet } from '@tanstack/svelte-table';
import { splitMemberRoles } from '#lib/api/organizations/member-roles.ts';
import type { OrganizationMember } from '#lib/api/organizations/members.ts';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import {
	type ResourceColumnDefs,
	resourceColumnHelper,
} from '#lib/components/resource/table/resource-table-model.ts';
import { auditActorHref } from '#lib/features/audit/lib/audit-list.ts';
import MemberRow from '#lib/features/organizations/components/members/member-row.svelte';
import type { MembersPage } from '#lib/features/organizations/state/members-page.svelte.ts';
import { formatDate } from '#lib/utils/format.ts';
import {
	formatOrganizationRoles,
	organizationRoleLabel,
} from '#lib/utils/organization-roles.ts';
import { pluralize } from '#lib/utils/text.ts';
import { goto } from '$app/navigation';

let { page }: { page: MembersPage } = $props();

const column = resourceColumnHelper<OrganizationMember>();
const columns: ResourceColumnDefs<OrganizationMember> = [
	column.display({
		id: 'user',
		header: 'User',
		meta: { grow: USER_COLUMN_GROW },
		cell: ({ row }) => renderSnippet(userCell, row.original),
	}),
	column.display({
		id: 'role',
		header: 'Role',
		meta: { grow: 1 },
		cell: ({ row }) => renderSnippet(roleCell, row.original),
	}),
	column.display({
		id: 'joined',
		header: 'Joined on',
		meta: { width: JOINED_COLUMN_WIDTH },
		cell: ({ row }) => formatDate(row.original.createdAt),
	}),
	column.display({
		id: 'actions',
		header: 'Actions',
		meta: { variant: 'actions' },
		cell: ({ row }) => renderSnippet(actionsCell, row.original),
	}),
];

function memberName(member: OrganizationMember): string {
	return member.user.name || member.user.email;
}
</script>

{#snippet userCell(member: OrganizationMember)}
	<MemberRow
		name={memberName(member)}
		email={member.user.email}
		self={member.userId === page.currentUserId}
	/>
{/snippet}

{#snippet roleCell(member: OrganizationMember)}
	{const roles = $derived(splitMemberRoles(member.role))}
	<div class="flex min-w-0 flex-col">
		<span class="truncate text-(--text-primary) text-sm">
			{organizationRoleLabel(roles.baseRole)}
		</span>
		{#if roles.additionalRoles.length > 0}
			<span class="truncate text-(--text-muted) text-xs">
				{formatOrganizationRoles(roles.additionalRoles)}
			</span>
		{/if}
	</div>
{/snippet}

{#snippet actionsCell(member: OrganizationMember)}
	{const self = $derived(member.userId === page.currentUserId)}
	{const editable = $derived(
		page.editableMember(splitMemberRoles(member.role))
	)}
	<ResourceRowActions
		reveal="always"
		label={`${memberName(member)} actions`}
		actions={[
			{
				icon: Pencil,
				label: 'Change role',
				visible: editable,
				onSelect: () => (page.editing = member),
			},
			{
				icon: Copy,
				label: 'Copy email',
				onSelect: () => page.copyEmail(member.user.email),
			},
			{
				icon: History,
				label: 'View activity',
				visible: page.canViewAudit,
				onSelect: () => void goto(auditActorHref(member.userId)),
			},
			{
				icon: UserMinus,
				label: 'Remove from organization',
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

<ResourceDataTable
	caption={`Members (${page.visibleMembers.length})`}
	variant="framed"
	{columns}
	data={page.visibleMembers}
	getRowId={(member) => member.id}
	rowLabel={memberName}
	sortConfig={page.sortConfig}
	sortedByServer
	footer={pluralize(page.visibleMembers.length, 'member')}
/>
