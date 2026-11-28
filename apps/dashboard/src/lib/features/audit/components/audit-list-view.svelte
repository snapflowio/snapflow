<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const TIME_COLUMN_WIDTH = 140;
const SOURCE_COLUMN_WIDTH = 104;
const ACTION_COLUMN_GROW = 1.5;
</script>

<script lang="ts">
import ScrollText from '@lucide/svelte/icons/scroll-text';
import type { AuditLog } from '@snapflow/api-client';
import { renderSnippet } from '@tanstack/svelte-table';
import EmptyState from '#lib/components/empty-state.svelte';
import ResourceFilterChips from '#lib/components/resource/filter/resource-filter-chips.svelte';
import ResourceFilterPanel from '#lib/components/resource/filter/resource-filter-panel.svelte';
import Resource from '#lib/components/resource/resource.svelte';
import ResourceDetailsPanel from '#lib/components/resource/resource-details-panel.svelte';
import ResourceHeader from '#lib/components/resource/resource-header.svelte';
import ResourceRefreshControl from '#lib/components/resource/resource-refresh-control.svelte';
import { resourceTextCell } from '#lib/components/resource/table/resource-cells.ts';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import {
	type ResourceColumnDefs,
	resourceColumnHelper,
} from '#lib/components/resource/table/resource-table-model.ts';
import IdentityTile from '#lib/components/ui/avatar/identity-tile.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipDateRangePicker from '#lib/components/ui/chip/chip-date-range-picker.svelte';
import Timestamp from '#lib/components/ui/timestamp.svelte';
import AuditEventDetails from '#lib/features/audit/components/audit-event-details.svelte';
import {
	AUDIT_VIA_LABEL,
	auditActionLabel,
	auditActorGlyph,
	auditActorLabel,
	auditFailed,
	auditVia,
} from '#lib/features/audit/lib/audit-event.ts';
import { AuditList } from '#lib/features/audit/state/audit-list.svelte.ts';

const list = new AuditList();
const panel = list.panel;

const column = resourceColumnHelper<AuditLog>();
const columns: ResourceColumnDefs<AuditLog> = [
	column.accessor('createdAt', {
		id: 'time',
		header: 'Time',
		meta: { width: TIME_COLUMN_WIDTH },
		cell: ({ row }) => renderSnippet(timeCell, row.original),
	}),
	column.accessor('action', {
		header: 'Action',
		meta: { grow: ACTION_COLUMN_GROW },
		cell: ({ row }) => renderSnippet(actionCell, row.original),
	}),
	column.display({
		id: 'actor',
		header: 'Actor',
		meta: { grow: 1, visibleFrom: 'md' },
		cell: ({ row }) => renderSnippet(actorCell, row.original),
	}),
	column.display({
		id: 'target',
		header: 'Resource',
		meta: { grow: 1, visibleFrom: 'xl' },
		cell: ({ row }) => renderSnippet(targetCell, row.original),
	}),
	column.display({
		id: 'via',
		header: 'Source',
		meta: { width: SOURCE_COLUMN_WIDTH, visibleFrom: 'lg' },
		cell: ({ row }) =>
			resourceTextCell({ label: AUDIT_VIA_LABEL[auditVia(row.original)] }),
	}),
];
</script>

{#snippet timeCell(entry: AuditLog)}
	<Timestamp value={entry.createdAt} />
{/snippet}

{#snippet actorCell(entry: AuditLog)}
	<span class="flex min-w-0 items-center gap-2">
		<IdentityTile name={auditActorGlyph(entry)} size="sm" />
		<span
			class={['truncate', auditVia(entry) === 'api_key' && 'font-mono text-xs']}
		>
			{auditActorLabel(entry)}
		</span>
	</span>
{/snippet}

{#snippet actionCell(entry: AuditLog)}
	<span class="flex min-w-0 items-center gap-2">
		<span class="truncate">{auditActionLabel(entry)}</span>
		{#if auditFailed(entry)}
			<Badge variant="error" size="sm">Failed</Badge>
		{/if}
	</span>
{/snippet}

{#snippet targetCell(entry: AuditLog)}
	<span class="block truncate font-mono text-xs">
		{entry.targetId ?? '—'}
	</span>
{/snippet}

{#snippet refreshControl()}
	<ResourceRefreshControl
		isRefreshing={list.auditQuery.isFetching}
		onIntervalChange={list.setRefreshInterval}
		onRefresh={list.refetch}
		value={list.refreshInterval}
	/>
{/snippet}

{#snippet filterContent()}
	<ResourceFilterPanel quickFields={list.quickFields} />
{/snippet}

{#snippet appliedFilters()}
	<div class="flex min-w-0 items-center gap-2 overflow-x-auto scrollbar-none">
		<ResourceFilterChips
			filterTags={list.filterTags}
			onClearFilters={list.clearFilters}
		/>
	</div>
{/snippet}

{#snippet toolbarTrailing()}
	{@render refreshControl()}
	<ChipDateRangePicker
		variant="ghost"
		startDate={list.from}
		endDate={list.to}
		showTime
		disabled={list.auditQuery.isLoading}
		onRangeChange={list.changeRange}
	/>
{/snippet}

{#snippet emptyState()}
	{#if list.filtered && list.auditQuery.hasNextPage}
		<EmptyState
			icon={ScrollText}
			bordered={false}
			title="No matches in the events loaded so far"
		>
			{#snippet actions()}
				<Chip
					variant="secondary"
					loading={list.auditQuery.isFetchingNextPage}
					onclick={list.loadMore}
				>
					Load older events
				</Chip>
			{/snippet}
		</EmptyState>
	{:else if list.filtered}
		<EmptyState
			icon={ScrollText}
			bordered={false}
			title="No events match these filters"
		>
			{#snippet actions()}
				<Chip variant="secondary" onclick={list.clearFilters}>
					Clear filters
				</Chip>
			{/snippet}
		</EmptyState>
	{:else}
		<EmptyState
			icon={ScrollText}
			bordered={false}
			title="No events in this time range yet"
		/>
	{/if}
{/snippet}

<Resource>
	<ResourceHeader
		title="Audit log"
		status={appliedFilters}
		search={{
			value: list.search.value,
			onChange: (value) => (list.search.value = value),
			placeholder: 'Search the audit log',
		}}
		filter={{ content: filterContent, active: list.fieldFiltersActive }}
		trailing={toolbarTrailing}
	/>
	<div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
		<ResourceDataTable
			caption="Audit log"
			{columns}
			data={list.events}
			getRowId={(event) => event.id}
			rowLabel={auditActionLabel}
			selectedRowId={panel.row?.id ?? null}
			onRowClick={panel.open}
			isLoading={list.auditQuery.isLoading}
			isFetching={list.auditQuery.isFetching}
			errorMessage={list.auditQuery.isError
				? "Couldn't load the audit log"
				: undefined}
			emptyMessage="No events yet"
			empty={emptyState}
			onRetry={list.refetch}
			hasMore={list.auditQuery.hasNextPage}
			loadingMore={list.auditQuery.isFetchingNextPage}
			onLoadMore={list.loadMore}
		/>
		<ResourceDetailsPanel
			open={panel.row !== null}
			title={panel.row ? auditActionLabel(panel.row) : 'Event'}
			resourceId={panel.row?.id}
			resourceIdLabel="Copy event ID"
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
