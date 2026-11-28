<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const USER_PANEL_TITLE = 'User';
const SKELETON_ROWS = 6;
</script>

<script lang="ts">
import VenetianMask from '@lucide/svelte/icons/venetian-mask';
import type { AdminUser } from '@snapflow/api-client';
import { renderSnippet } from '@tanstack/svelte-table';
import FeedbackState from '#lib/components/feedback-state.svelte';
import Trash from '#lib/components/icons/trash.svelte';
import Resource from '#lib/components/resource/resource.svelte';
import ResourceDetailsPanel from '#lib/components/resource/resource-details-panel.svelte';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
import ResourceRowContextMenu from '#lib/components/resource/resource-row-context-menu.svelte';
import { renderResourceLabel } from '#lib/components/resource/table/resource-cell.ts';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import { resourceColumnHelper } from '#lib/components/resource/table/resource-table-model.ts';
import { timestampCell } from '#lib/components/resource/table/rich-cells.ts';
import TableFooter from '#lib/components/resource/table/table-footer.svelte';
import IdentityTile from '#lib/components/ui/avatar/identity-tile.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import { chipContentGap } from '#lib/components/ui/chip/chip-chrome.ts';
import IconButton from '#lib/components/ui/icon-button.svelte';
import OverflowText from '#lib/components/ui/overflow/overflow-text.svelte';
import Skeleton from '#lib/components/ui/skeleton/skeleton.svelte';
import AdminTableEmpty from '#lib/features/admin/components/shared/admin-table-empty.svelte';
import AdminToolbar from '#lib/features/admin/components/shared/admin-toolbar.svelte';
import AdminUserDialogs from '#lib/features/admin/components/users/admin-user-dialogs.svelte';
import UserDetails from '#lib/features/admin/components/users/user-details.svelte';
import {
	LABEL_COLUMN,
	NAME_COLUMN,
	STATUS_COLUMN,
	TAG_COLUMN,
	TIME_COLUMN,
} from '#lib/features/admin/lib/admin-columns.ts';
import {
	adminLoadErrorMessage,
	adminTableError,
	isAdminNotFound,
} from '#lib/features/admin/lib/admin-load-error.ts';
import {
	isAdminUser,
	secondFactorLabel,
} from '#lib/features/admin/state/admin-user-actions.svelte.ts';
import { UsersList } from '#lib/features/admin/state/users-list.svelte.ts';
import { countLabel } from '#lib/utils/format.ts';

const list = new UsersList();

const column = resourceColumnHelper<AdminUser>();
const columns = [
	column.accessor((user) => user.name || user.email, {
		id: 'name',
		header: 'User',
		meta: NAME_COLUMN,
		cell: ({ row }) => renderSnippet(userCell, row.original),
	}),
	column.accessor('role', {
		id: 'role',
		header: 'Role',
		meta: { ...TAG_COLUMN, visibleFrom: 'lg' },
		cell: ({ row }) =>
			renderResourceLabel({
				label: isAdminUser(row.original) ? 'Admin' : 'User',
			}),
	}),
	column.accessor('banned', {
		id: 'status',
		header: 'Status',
		meta: STATUS_COLUMN,
		cell: ({ row }) => renderSnippet(statusCell, row.original),
	}),
	column.accessor(secondFactorLabel, {
		id: 'secondFactor',
		header: 'Second factor',
		meta: { ...LABEL_COLUMN, visibleFrom: 'xl' },
		cell: ({ getValue }) => renderResourceLabel({ label: getValue() }),
	}),
	column.accessor('createdAt', {
		id: 'created',
		header: 'Joined',
		meta: TIME_COLUMN,
		cell: ({ getValue }) => timestampCell(getValue()),
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

{#snippet userCell(user: AdminUser)}
	<span class={['flex min-w-0 items-center', chipContentGap]}>
		<IdentityTile name={user.name || user.email} size="sm" />
		<span class="flex min-w-0 items-baseline gap-1.5">
			<OverflowText
				text={user.name || user.email}
				class="max-w-full shrink-0"
			/>
			{#if user.name}
				<span class="min-w-0 truncate text-(--text-muted) text-xs">
					{user.email}
				</span>
			{/if}
		</span>
	</span>
{/snippet}

{#snippet statusCell(user: AdminUser)}
	<Badge size="sm" variant={user.banned ? 'error' : 'success'}>
		{user.banned ? 'Banned' : 'Active'}
	</Badge>
{/snippet}

{#snippet actionsCell(user: AdminUser)}
	<ResourceRowActions
		label={`${user.email} actions`}
		actions={list.actions.rowActions(user)}
	/>
{/snippet}

{#snippet emptyState()}
	<AdminTableEmpty
		message="No users yet"
		resource="users"
		search={list.controls.query}
		filterCount={list.controls.filterCount}
		onClear={list.controls.clearSearchAndFilters}
	/>
{/snippet}

{#snippet panelActions()}
	{#if list.openUser && !list.actions.isSelf(list.openUser)}
		{const user = $derived(list.openUser)}
		<IconButton
			variant="ghost"
			label="Impersonate"
			icon={VenetianMask}
			disabled={list.actions.impersonatingId !== null}
			onclick={() => list.actions.startImpersonation(user)}
		/>
		<IconButton
			variant="ghost"
			label="Delete user"
			icon={Trash}
			onclick={() => list.actions.open('remove', user)}
		/>
	{/if}
{/snippet}

{#snippet detailsPanel()}
	<ResourceDetailsPanel
		open={list.panel.openId !== null}
		title={list.openUser
			? list.openUser.name || list.openUser.email
			: USER_PANEL_TITLE}
		resourceId={list.openUser?.id}
		resourceIdLabel="Copy user ID"
		onClose={list.panel.close}
		onPrevious={list.panel.previous}
		onNext={list.panel.next}
		actions={panelActions}
	>
		{#if list.openUser}
			<UserDetails user={list.openUser} actions={list.actions} />
		{:else if list.userQuery.isError}
			{#if isAdminNotFound(list.userQuery.error)}
				<FeedbackState variant="inline" message="User not found" />
			{:else}
				<FeedbackState
					tone="error"
					variant="inline"
					message={adminLoadErrorMessage(list.userQuery.error, 'this user')}
					error={list.userQuery.error}
					retrying={list.userQuery.isFetching}
					onRetry={() => void list.userQuery.refetch()}
				/>
			{/if}
		{:else if list.panel.openId !== null}
			<Skeleton class="mt-5 h-7" repeat={SKELETON_ROWS} fade />
		{/if}
	</ResourceDetailsPanel>
{/snippet}

<Resource>
	<AdminToolbar
		title="Users"
		controls={list.controls}
		searchPlaceholder="Search users"
	/>
	<ResourceRowContextMenu
		actionsFor={(rowId) => (rowId === null ? [] : list.userRowActions(rowId))}
	>
		<ResourceDataTable
			caption="Users"
			{columns}
			data={list.users}
			getRowId={(user) => user.id}
			rowLabel={(user) => user.email}
			sort={list.controls.sort}
			sortConfig={list.controls.sortConfig}
			sortedByServer
			selectedRowId={list.panel.openId}
			isLoading={list.usersQuery.isLoading}
			isFetching={list.usersQuery.isRefetching}
			errorMessage={adminTableError(list.usersQuery.error, 'users')}
			empty={emptyState}
			onRetry={() => void list.usersQuery.refetch()}
			onRowClick={list.panel.open}
			rowContextMenu
			hasMore={list.usersQuery.hasNextPage}
			loadingMore={list.usersQuery.isFetchingNextPage}
			onLoadMore={() => void list.usersQuery.fetchNextPage()}
			overlay={detailsPanel}
		/>
	</ResourceRowContextMenu>
	<TableFooter
		label={countLabel(
			list.users.length,
			'user',
			undefined,
			list.usersQuery.hasNextPage
		)}
	/>
</Resource>
<AdminUserDialogs actions={list.actions} />
