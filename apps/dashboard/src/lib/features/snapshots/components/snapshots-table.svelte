<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { SnapshotDto } from '@snapflow/api-client';
import type { Snippet } from 'svelte';
import type { ResourceBulkAction } from '#lib/components/resource/resource-bulk-action-bar.svelte';
import type { ResourceSortConfig } from '#lib/components/resource/resource-options.ts';
import type { ResourcePaginationConfig } from '#lib/components/resource/resource-pagination.ts';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';

const SYSTEM_LABEL = 'System';
const DECLARATIVE_LABEL = 'Declarative build';
const NAME_COLUMN_GROW = 2;
const COLUMN_WIDTH = {
	state: 120,
	resources: 128,
	size: 88,
	created: 112,
} as const;

interface SnapshotsTableProps {
	snapshots: readonly SnapshotDto[];
	isLoading: boolean;
	isError: boolean;
	onRetry: () => void;
	selectable: boolean;
	selectedRowIds?: string[];
	openSnapshotId: string | null;
	onOpen: (snapshotId: string) => void;
	rowActions: (snapshot: SnapshotDto) => readonly ResourceRowAction[];
	quickActions: (snapshot: SnapshotDto) => readonly ResourceRowAction[];
	bulkActions: readonly ResourceBulkAction[];
	onDeleteSelection?: (ids: string[]) => void;
	sortConfig: ResourceSortConfig;
	pagination: ResourcePaginationConfig;
	footer: string;
	empty: Snippet;
}
</script>

<script lang="ts">
import { renderSnippet } from '@tanstack/svelte-table';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import { resourceTextCell } from '#lib/components/resource/table/resource-cells.ts';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import {
	EMPTY_CELL_PLACEHOLDER,
	QUICK_ACTION_COLUMN_PX,
} from '#lib/components/resource/table/resource-table.ts';
import {
	type ResourceColumnDefs,
	resourceColumnHelper,
} from '#lib/components/resource/table/resource-table-model.ts';
import { timestampCell } from '#lib/components/resource/table/rich-cells.ts';
import Badge from '#lib/components/ui/badge.svelte';
import { formatSnapshotSize } from '#lib/features/snapshots/lib/snapshots-list.ts';

let {
	snapshots,
	isLoading,
	isError,
	onRetry,
	selectable,
	selectedRowIds = $bindable([]),
	openSnapshotId,
	onOpen,
	rowActions,
	quickActions,
	bulkActions,
	onDeleteSelection,
	sortConfig,
	pagination,
	footer,
	empty,
}: SnapshotsTableProps = $props();

const column = resourceColumnHelper<SnapshotDto>();
const columns: ResourceColumnDefs<SnapshotDto> = $derived([
	...(selectable
		? [
				column.display({
					id: 'selection',
					header: 'Select',
					meta: { variant: 'selection' },
				}),
			]
		: []),
	column.accessor('name', {
		header: 'Name',
		meta: { grow: NAME_COLUMN_GROW },
		cell: ({ row }) => renderSnippet(nameCell, row.original),
	}),
	column.accessor('state', {
		header: 'State',
		meta: { width: COLUMN_WIDTH.state },
		cell: ({ row }) => renderSnippet(stateCell, row.original),
	}),
	column.display({
		id: 'resources',
		header: 'Resources',
		meta: { width: COLUMN_WIDTH.resources, visibleFrom: 'xl' },
		cell: ({ row }) =>
			resourceTextCell({
				label: `${row.original.cpu} vCPU · ${row.original.mem} GiB`,
			}),
	}),
	column.accessor('size', {
		header: 'Size',
		meta: { width: COLUMN_WIDTH.size, visibleFrom: 'md' },
		cell: ({ getValue }) => {
			const size = getValue();
			return resourceTextCell({
				label:
					size === null ? EMPTY_CELL_PLACEHOLDER : formatSnapshotSize(size),
			});
		},
	}),
	column.accessor('createdAt', {
		id: 'created',
		header: 'Created',
		meta: { width: COLUMN_WIDTH.created, visibleFrom: 'md' },
		cell: ({ getValue }) => timestampCell(getValue()),
	}),
	column.display({
		id: 'actions',
		header: 'Actions',
		meta: { variant: 'actions', width: QUICK_ACTION_COLUMN_PX },
		cell: ({ row }) => renderSnippet(actionsCell, row.original),
	}),
]);

function imageCaption(snapshot: SnapshotDto): string | null {
	if (snapshot.imageName) {
		return snapshot.imageName === snapshot.name ? null : snapshot.imageName;
	}
	return snapshot.buildInfo ? DECLARATIVE_LABEL : null;
}
</script>

{#snippet nameCell(snapshot: SnapshotDto)}
	{@const caption = imageCaption(snapshot)}
	<span class="flex min-w-0 items-baseline gap-2">
		<span class="min-w-0 truncate text-(--text-primary)">{snapshot.name}</span>
		{#if caption}
			<span
				class="min-w-0 truncate font-mono text-(--text-subtle) text-xs max-md:hidden"
			>
				{caption}
			</span>
		{/if}
		{#if snapshot.general}
			<Badge size="pill" class="self-center">{SYSTEM_LABEL}</Badge>
		{/if}
	</span>
{/snippet}

{#snippet stateCell(snapshot: SnapshotDto)}
	<ResourceStateBadge
		errorReason={snapshot.errorReason}
		state={snapshot.state}
	/>
{/snippet}

{#snippet actionsCell(snapshot: SnapshotDto)}
	<ResourceRowActions
		label={`Actions for ${snapshot.name}`}
		actions={rowActions(snapshot)}
		quick={quickActions(snapshot)}
	/>
{/snippet}

<ResourceDataTable
	caption="Snapshots"
	{columns}
	data={snapshots}
	getRowId={(snapshot) => snapshot.id}
	rowLabel={(snapshot) => snapshot.name}
	{sortConfig}
	sortedByServer
	{pagination}
	{footer}
	{isLoading}
	errorMessage={isError ? "Couldn't load snapshots" : undefined}
	{onRetry}
	{empty}
	selectedRowId={openSnapshotId}
	onRowClick={onOpen}
	rowContextMenu
	selection={selectable
		? {
				selectedRowIds,
				onChange: (ids) => (selectedRowIds = ids),
				isRowSelectable: (snapshot) => !snapshot.general,
			}
		: undefined}
	{bulkActions}
	{onDeleteSelection}
/>
