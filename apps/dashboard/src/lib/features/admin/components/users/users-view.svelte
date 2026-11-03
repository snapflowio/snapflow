<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import UserIcon from '@lucide/svelte/icons/user';
import UserX from '@lucide/svelte/icons/user-x';
import type { AdminUser } from '@snapflow/api-client';
import { renderSnippet } from '@tanstack/svelte-table';
import Loading from '#lib/components/loading.svelte';
import PageHeaderBar from '#lib/components/page/page-header-bar.svelte';
import Resource from '#lib/components/resource/resource.svelte';
import ResourceHeader from '#lib/components/resource/resource-header.svelte';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
import { renderResourceLabel } from '#lib/components/resource/table/resource-cell.ts';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import { resourceColumnHelper } from '#lib/components/resource/table/resource-table-model.ts';
import { timeCell } from '#lib/components/resource/table/time-cell.ts';
import Badge from '#lib/components/ui/badge.svelte';
import AdminListEmpty from '#lib/features/admin/components/admin-list-empty.svelte';
import AdminListOptionsBar from '#lib/features/admin/components/admin-list-options-bar.svelte';
import AdminResourceNotFound from '#lib/features/admin/components/admin-resource-not-found.svelte';
import AdminTableContextMenu from '#lib/features/admin/components/admin-table-context-menu.svelte';
import { adminTableErrorProps } from '#lib/features/admin/components/admin-table-error.svelte';
import AdminUserDialogs from '#lib/features/admin/components/users/admin-user-dialogs.svelte';
import UserDetails from '#lib/features/admin/components/users/user-details.svelte';
import {
	isAdminUser,
	secondFactorLabel,
} from '#lib/features/admin/state/admin-user-actions.svelte.ts';
import { UsersList } from '#lib/features/admin/state/users-list.svelte.ts';

const list = new UsersList();

const column = resourceColumnHelper<AdminUser>();
const columns = [
	column.accessor((user) => user.name || user.email, {
		id: 'name',
		header: 'User',
		cell: ({ row }) =>
			renderResourceLabel({
				icon: userIcon,
				label: row.original.name || row.original.email,
				sublabel: row.original.name ? row.original.email : undefined,
			}),
	}),
	column.accessor('role', {
		id: 'role',
		header: 'Role',
		cell: ({ row }) => renderSnippet(roleCell, row.original),
	}),
	column.accessor('banned', {
		id: 'status',
		header: 'Status',
		cell: ({ row }) => renderSnippet(statusCell, row.original),
	}),
	column.accessor(secondFactorLabel, {
		id: 'secondFactor',
		header: 'Second factor',
		cell: ({ getValue }) => renderResourceLabel({ label: getValue() }),
	}),
	column.accessor('createdAt', {
		id: 'created',
		header: 'Joined',
		cell: ({ getValue }) => renderResourceLabel(timeCell(getValue())),
	}),
	column.display({
		id: 'actions',
		header: 'Actions',
		meta: { variant: 'actions' },
		cell: ({ row }) => renderSnippet(actionsCell, row.original),
	}),
];
</script>

<svelte:head>
	<title>
		{list.openUser
			? `${list.openUser.name || list.openUser.email} · Snapflow`
			: 'Users · Snapflow'}
	</title>
</svelte:head>

{#snippet userIcon()}
	<UserIcon />
{/snippet}

{#snippet roleCell(
	user: AdminUser
)}
	<Badge size="sm" variant={isAdminUser(user) ? 'blue' : 'gray'}>
		{isAdminUser(user) ? 'Admin' : 'User'}
	</Badge>
{/snippet}

{#snippet statusCell(
	user: AdminUser
)}
	<Badge size="sm" variant={user.banned ? 'red' : 'green'}>
		{user.banned ? 'Banned' : 'Active'}
	</Badge>
{/snippet}

{#snippet actionsCell(
	user: AdminUser
)}
	<ResourceRowActions
		label={`${user.email} actions`}
		actions={list.actions.rowActions(user)}
	/>
{/snippet}

{#snippet emptyState()}
	<AdminListEmpty
		search={list.controls.query}
		filterCount={list.controls.filterTags.length}
		onClear={list.controls.clearSearchAndFilters}
		title="Users"
		description="Everyone who signs up to Snapflow appears here."
	/>
{/snippet}

{#if list.openUserId}
	{#if list.openUser}
		<UserDetails
			user={list.openUser}
			actions={list.actions}
			onBack={list.closeUser}
		/>
	{:else if list.usersQuery.isPending}
		<Loading />
	{:else}
		<div class="flex h-full min-h-0 flex-col bg-bg">
			<PageHeaderBar back={{ label: 'Users', onSelect: list.closeUser }} />
			<AdminResourceNotFound
				icon={UserX}
				title="User not found"
				description="This user may have been deleted or is outside the loaded results"
			/>
		</div>
	{/if}
{:else}
	<Resource>
		<ResourceHeader icon={UserIcon} title="Users" />
		<AdminListOptionsBar
			controls={list.controls}
			placeholder="Search users..."
			ariaLabel="Search users"
		/>
		<AdminTableContextMenu rowActions={list.userRowActions}>
			<ResourceDataTable
				caption="Users"
				{columns}
				data={list.users}
				getRowId={(user) => user.id}
				rowLabel={(user) => user.email}
				sort={list.controls.sort}
				isLoading={list.usersQuery.isLoading}
				empty={emptyState}
				onRetry={() => void list.usersQuery.refetch()}
				onRowClick={list.openDetails}
				onRowContextMenu={() => {}}
				hasMore={list.usersQuery.hasNextPage}
				loadingMore={list.usersQuery.isFetchingNextPage}
				onLoadMore={() => void list.usersQuery.fetchNextPage()}
				{...adminTableErrorProps(list.usersQuery.error, 'Failed to load users')}
			/>
		</AdminTableContextMenu>
	</Resource>
{/if}
<AdminUserDialogs actions={list.actions} />
