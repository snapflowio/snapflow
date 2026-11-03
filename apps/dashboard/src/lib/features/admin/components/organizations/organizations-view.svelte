<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Users from '@lucide/svelte/icons/users';
import type { AdminOrganization } from '@snapflow/api-client';
import { renderSnippet } from '@tanstack/svelte-table';
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
import AdminTableContextMenu from '#lib/features/admin/components/admin-table-context-menu.svelte';
import { adminTableErrorProps } from '#lib/features/admin/components/admin-table-error.svelte';
import OrganizationDialogs from '#lib/features/admin/components/organizations/organization-dialogs.svelte';
import {
	adminOrganizationStatus,
	adminOrganizationStatusId,
} from '#lib/features/admin/lib/organization-status.ts';
import { OrganizationsList } from '#lib/features/admin/state/organizations-list.svelte.ts';
import { formatUsd } from '#lib/utils/usd.ts';

const list = new OrganizationsList();

const column = resourceColumnHelper<AdminOrganization>();
const columns = [
	column.accessor('name', {
		id: 'name',
		header: 'Organization',
		cell: ({ row }) =>
			renderResourceLabel({
				icon: usersIcon,
				label: row.original.name,
				sublabel: row.original.slug,
			}),
	}),
	column.accessor(
		(organization) => (organization.personal ? 'Personal' : 'Team'),
		{
			id: 'type',
			header: 'Type',
			cell: ({ getValue }) => renderResourceLabel({ label: getValue() }),
		}
	),
	column.accessor(adminOrganizationStatusId, {
		id: 'status',
		header: 'Status',
		cell: ({ row }) => renderSnippet(statusCell, row.original),
	}),
	column.accessor('memberCount', {
		id: 'members',
		header: 'Members',
		cell: ({ getValue }) => renderResourceLabel({ label: String(getValue()) }),
	}),
	column.accessor(
		(organization) => Number(organization.creditBalanceMicroUsd),
		{
			id: 'credit',
			header: 'Credit',
			cell: ({ row }) =>
				renderResourceLabel({
					label: formatUsd(row.original.creditBalanceMicroUsd),
				}),
		}
	),
	column.accessor('createdAt', {
		id: 'created',
		header: 'Created',
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

{#snippet usersIcon()}
	<Users />
{/snippet}

{#snippet statusCell(
	organization: AdminOrganization
)}
	{const status = $derived(adminOrganizationStatus(organization))}
	<Badge size="sm" variant={status.variant}>{status.label}</Badge>
{/snippet}

{#snippet actionsCell(
	organization: AdminOrganization
)}
	<ResourceRowActions
		label={`${organization.name} actions`}
		actions={list.actions.rowActions(organization)}
	/>
{/snippet}

{#snippet emptyState()}
	<AdminListEmpty
		search={list.controls.query}
		filterCount={list.controls.filterTags.length}
		onClear={list.controls.clearSearchAndFilters}
		title="Organizations"
		description="Every personal and team organization appears here."
	/>
{/snippet}

<Resource>
	<ResourceHeader icon={Users} title="Organizations" />
	<AdminListOptionsBar
		controls={list.controls}
		placeholder="Search organizations..."
		ariaLabel="Search organizations"
	/>
	<AdminTableContextMenu rowActions={list.organizationRowActions}>
		<ResourceDataTable
			caption="Organizations"
			{columns}
			data={list.organizations}
			getRowId={(organization) => organization.id}
			rowLabel={(organization) => organization.name}
			sort={list.controls.sort}
			isLoading={list.organizationsQuery.isLoading}
			empty={emptyState}
			onRetry={() => void list.organizationsQuery.refetch()}
			onRowClick={list.openOrganization}
			onRowContextMenu={() => {}}
			hasMore={list.organizationsQuery.hasNextPage}
			loadingMore={list.organizationsQuery.isFetchingNextPage}
			onLoadMore={() => void list.organizationsQuery.fetchNextPage()}
			{...adminTableErrorProps(
				list.organizationsQuery.error,
				'Failed to load organizations'
			)}
		/>
	</AdminTableContextMenu>
</Resource>
<OrganizationDialogs actions={list.actions} />
