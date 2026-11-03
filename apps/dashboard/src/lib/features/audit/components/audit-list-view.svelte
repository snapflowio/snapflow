<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ShieldCheck from '@lucide/svelte/icons/shield-check';
import X from '@lucide/svelte/icons/x';
import type { AuditLog } from '@snapflow/api-client';
import { renderSnippet } from '@tanstack/svelte-table';
import Resource from '#lib/components/resource/resource.svelte';
import ResourceDetailsPanel from '#lib/components/resource/resource-details-panel.svelte';
import ResourceHeader from '#lib/components/resource/resource-header.svelte';
import ResourceOptionsBar from '#lib/components/resource/resource-options-bar.svelte';
import ResourceRefreshControl from '#lib/components/resource/resource-refresh-control.svelte';
import {
	resourceCell,
	resourceTextCell,
} from '#lib/components/resource/table/resource-cells.ts';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import {
	type ResourceColumnDefs,
	resourceColumnHelper,
} from '#lib/components/resource/table/resource-table-model.ts';
import { timeCell } from '#lib/components/resource/table/time-cell.ts';
import Badge from '#lib/components/ui/badge.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipDateRangePicker from '#lib/components/ui/chip/chip-date-range-picker.svelte';
import AuditEventDetails from '#lib/features/audit/components/audit-event-details.svelte';
import {
	auditActorLabel,
	auditStatusVariant,
} from '#lib/features/audit/lib/audit-event.ts';
import { ACTION_COLUMN_WIDTH } from '#lib/features/audit/lib/audit-list.ts';
import { AuditList } from '#lib/features/audit/state/audit-list.svelte.ts';

const list = new AuditList();
const panel = list.panel;

const column = resourceColumnHelper<AuditLog>();
const columns: ResourceColumnDefs<AuditLog> = [
	column.accessor('action', {
		header: 'Action',
		meta: { widthMultiplier: ACTION_COLUMN_WIDTH },
		cell: ({ row }) =>
			resourceCell(
				{ icon: actionIcon, label: row.original.action },
				row.original
			),
	}),
	column.accessor('createdAt', {
		id: 'date',
		header: 'Date',
		cell: ({ getValue }) => resourceTextCell(timeCell(getValue())),
	}),
	column.display({
		id: 'status',
		header: 'Status',
		cell: ({ row }) =>
			row.original.statusCode
				? renderSnippet(statusBadge, row.original)
				: resourceTextCell({}),
	}),
	column.display({
		id: 'actor',
		header: 'Actor',
		cell: ({ row }) =>
			resourceTextCell({ label: auditActorLabel(row.original) }),
	}),
	column.display({
		id: 'target',
		header: 'Target',
		cell: ({ row }) =>
			resourceTextCell({
				label: row.original.targetType,
				sublabel: row.original.targetId,
			}),
	}),
	column.display({
		id: 'source',
		header: 'Source',
		cell: ({ row }) =>
			resourceTextCell({
				label: row.original.source ?? row.original.ipAddress,
			}),
	}),
];
</script>

{#snippet actionIcon()}
	<ShieldCheck class="size-3.5" />
{/snippet}

{#snippet statusBadge({
	statusCode,
}: AuditLog)}
	{#if statusCode}
		<Badge size="sm" variant={auditStatusVariant(statusCode)}>
			{statusCode}
		</Badge>
	{/if}
{/snippet}

{#snippet refreshControl()}
	<ResourceRefreshControl
		isRefreshing={list.auditQuery.isFetching}
		onIntervalChange={list.setRefreshInterval}
		onRefresh={list.refetch}
		value={list.refreshInterval}
	/>
{/snippet}

{#snippet extras()}
	<ChipDateRangePicker
		startDate={list.from}
		endDate={list.to}
		showTime
		disabled={list.auditQuery.isLoading}
		onRangeChange={list.changeRange}
	/>
	{#if list.from || list.to}
		<Chip rightIcon={X} onclick={list.clearRange}>Clear dates</Chip>
	{/if}
{/snippet}

<Resource>
	<ResourceHeader
		icon={ShieldCheck}
		title="Audit logs"
		trailing={refreshControl}
	/>
	<ResourceOptionsBar
		search={{
			value: list.search.value,
			onChange: (value) => (list.search.value = value),
			placeholder: 'Search audit logs...',
		}}
		{extras}
		extrasAlign="end"
	/>
	<div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
		<ResourceDataTable
			caption="Audit logs"
			{columns}
			data={list.events}
			getRowId={(event) => event.id}
			rowLabel={(event) => event.action}
			selectedRowId={panel.row?.id ?? null}
			onRowClick={panel.open}
			isLoading={list.auditQuery.isLoading}
			errorMessage={list.auditQuery.isError
				? 'Failed to load audit logs'
				: undefined}
			emptyMessage={list.filtered
				? 'No audit events match these filters'
				: 'No audit events yet'}
			onRetry={list.refetch}
			hasMore={list.auditQuery.hasNextPage}
			loadingMore={list.auditQuery.isFetchingNextPage}
			onLoadMore={list.loadMore}
		/>
		<ResourceDetailsPanel
			open={panel.row !== null}
			title="Event details"
			onClose={panel.close}
			onPrevious={panel.previous}
			onNext={panel.next}
		>
			{#if panel.row}
				<AuditEventDetails auditEvent={panel.row} />
			{/if}
		</ResourceDetailsPanel>
	</div>
</Resource>
