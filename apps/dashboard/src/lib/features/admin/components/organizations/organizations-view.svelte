<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { AdminOrganization } from '@snapflow/api-client';
import { renderSnippet } from '@tanstack/svelte-table';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
import ResourceRowContextMenu from '#lib/components/resource/resource-row-context-menu.svelte';
import { renderResourceLabel } from '#lib/components/resource/table/resource-cell.ts';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import { resourceColumnHelper } from '#lib/components/resource/table/resource-table-model.ts';
import {
	moneyCell,
	timestampCell,
} from '#lib/components/resource/table/rich-cells.ts';
import TableFooter from '#lib/components/resource/table/table-footer.svelte';
import IdentityTile from '#lib/components/ui/avatar/identity-tile.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import { chipContentGap } from '#lib/components/ui/chip/chip-chrome.ts';
import OverflowText from '#lib/components/ui/overflow/overflow-text.svelte';
import OrganizationDialogs from '#lib/features/admin/components/organizations/organization-dialogs.svelte';
import AdminTableEmpty from '#lib/features/admin/components/shared/admin-table-empty.svelte';
import AdminToolbar from '#lib/features/admin/components/shared/admin-toolbar.svelte';
import {
	COUNT_COLUMN,
	MONEY_COLUMN,
	NAME_COLUMN,
	STATUS_COLUMN,
	TAG_COLUMN,
	TIME_COLUMN,
} from '#lib/features/admin/lib/admin-columns.ts';
import { adminTableError } from '#lib/features/admin/lib/admin-load-error.ts';
import {
	adminOrganizationStatus,
	adminOrganizationStatusId,
	organizationTypeLabel,
} from '#lib/features/admin/lib/organization-status.ts';
import type { AdminViewSwitch } from '#lib/features/admin/state/admin-view-param.svelte.ts';
import { OrganizationsList } from '#lib/features/admin/state/organizations-list.svelte.ts';
import { countLabel, formatCount } from '#lib/utils/format.ts';

interface OrganizationsViewProps {
	title: string;
	viewSwitch: AdminViewSwitch;
}

let { title, viewSwitch }: OrganizationsViewProps = $props();

const list = new OrganizationsList();

const column = resourceColumnHelper<AdminOrganization>();
const columns = [
	column.accessor('name', {
		id: 'name',
		header: 'Organization',
		meta: NAME_COLUMN,
		cell: ({ row }) => renderSnippet(nameCell, row.original),
	}),
	column.accessor(organizationTypeLabel, {
		id: 'type',
		header: 'Type',
		meta: { ...TAG_COLUMN, visibleFrom: 'lg' },
		cell: ({ getValue }) => renderResourceLabel({ label: getValue() }),
	}),
	column.accessor(adminOrganizationStatusId, {
		id: 'status',
		header: 'Status',
		meta: STATUS_COLUMN,
		cell: ({ row }) => renderSnippet(statusCell, row.original),
	}),
	column.accessor('memberCount', {
		id: 'members',
		header: 'Members',
		meta: { ...COUNT_COLUMN, visibleFrom: 'xl' },
		cell: ({ getValue }) =>
			renderResourceLabel({ label: formatCount(getValue()) }),
	}),
	column.accessor(
		(organization) => Number(organization.creditBalanceMicroUsd),
		{
			id: 'balance',
			header: 'Balance',
			meta: MONEY_COLUMN,
			cell: ({ row }) => moneyCell(row.original.creditBalanceMicroUsd),
		}
	),
	column.accessor('createdAt', {
		id: 'created',
		header: 'Created',
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

{#snippet nameCell(organization: AdminOrganization)}
	<span class={['flex min-w-0 items-center', chipContentGap]}>
		<IdentityTile name={organization.name} size="sm" />
		<span class="flex min-w-0 items-baseline gap-1.5">
			<OverflowText text={organization.name} class="max-w-full shrink-0" />
			<span class="min-w-0 truncate text-(--text-muted) text-xs">
				{organization.slug}
			</span>
		</span>
	</span>
{/snippet}

{#snippet statusCell(organization: AdminOrganization)}
	{const status = $derived(adminOrganizationStatus(organization))}
	<Badge size="sm" variant={status.variant}>{status.label}</Badge>
{/snippet}

{#snippet actionsCell(organization: AdminOrganization)}
	<ResourceRowActions
		label={`${organization.name} actions`}
		actions={list.actions.rowActions(organization)}
	/>
{/snippet}

{#snippet emptyState()}
	<AdminTableEmpty
		message="No organizations yet"
		resource="organizations"
		search={list.controls.query}
		filterCount={list.controls.filterCount}
		onClear={list.controls.clearSearchAndFilters}
	/>
{/snippet}

<AdminToolbar
	{title}
	{viewSwitch}
	controls={list.controls}
	searchPlaceholder="Search organizations"
/>
<ResourceRowContextMenu
	actionsFor={(rowId) =>
		rowId === null ? [] : list.organizationRowActions(rowId)}
>
	<ResourceDataTable
		caption="Organizations"
		{columns}
		data={list.organizations}
		getRowId={(organization) => organization.id}
		rowLabel={(organization) => organization.name}
		rowDimmed={(organization) => organization.deletedAt !== null}
		sort={list.controls.sort}
		sortConfig={list.controls.sortConfig}
		sortedByServer
		isLoading={list.organizationsQuery.isLoading}
		isFetching={list.organizationsQuery.isRefetching}
		errorMessage={adminTableError(
			list.organizationsQuery.error,
			'organizations'
		)}
		empty={emptyState}
		onRetry={() => void list.organizationsQuery.refetch()}
		onRowClick={list.openOrganization}
		rowContextMenu
		hasMore={list.organizationsQuery.hasNextPage}
		loadingMore={list.organizationsQuery.isFetchingNextPage}
		onLoadMore={() => void list.organizationsQuery.fetchNextPage()}
	/>
</ResourceRowContextMenu>
<TableFooter
	label={countLabel(
		list.organizations.length,
		'organization',
		undefined,
		list.organizationsQuery.hasNextPage
	)}
/>
<OrganizationDialogs actions={list.actions} />
