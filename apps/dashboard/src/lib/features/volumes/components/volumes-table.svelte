<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { VolumeDto } from '@snapflow/api-client';
import type { Snippet } from 'svelte';
import type { ResourceBulkAction } from '#lib/components/resource/resource-bulk-action-bar.svelte';
import type { ResourceSortConfig } from '#lib/components/resource/resource-options.ts';
import type { ResourcePaginationConfig } from '#lib/components/resource/resource-pagination.ts';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';

const NEVER_USED_LABEL = 'Never used';
const VOLUME_ID_PREVIEW_CHARACTERS = 8;
const NAME_COLUMN_GROW = 2;
const COLUMN_WIDTH = {
	state: 120,
	size: 88,
	lastUsed: 112,
	created: 112,
} as const;

interface VolumesTableProps {
	volumes: readonly VolumeDto[];
	isLoading: boolean;
	isError: boolean;
	openVolumeId: string | null;
	onOpen: (volumeId: string) => void;
	onRetry: () => void;
	selectable: boolean;
	selectedRowIds?: string[];
	rowActions: (volume: VolumeDto) => readonly ResourceRowAction[];
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
	type ResourceColumnDefs,
	resourceColumnHelper,
} from '#lib/components/resource/table/resource-table-model.ts';
import { timestampCell } from '#lib/components/resource/table/rich-cells.ts';

let {
	volumes,
	isLoading,
	isError,
	openVolumeId,
	onOpen,
	onRetry,
	selectable,
	selectedRowIds = $bindable([]),
	rowActions,
	bulkActions,
	onDeleteSelection,
	sortConfig,
	pagination,
	footer,
	empty,
}: VolumesTableProps = $props();

const column = resourceColumnHelper<VolumeDto>();
const columns: ResourceColumnDefs<VolumeDto> = $derived([
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
	column.accessor('sizeGiB', {
		id: 'size',
		header: 'Size',
		meta: { width: COLUMN_WIDTH.size, visibleFrom: 'md' },
		cell: ({ getValue }) => resourceTextCell({ label: `${getValue()} GiB` }),
	}),
	column.accessor('lastUsedAt', {
		id: 'lastUsed',
		header: 'Last used',
		meta: { width: COLUMN_WIDTH.lastUsed, visibleFrom: 'md' },
		cell: ({ getValue }) => timestampCell(getValue(), NEVER_USED_LABEL),
	}),
	column.accessor('createdAt', {
		id: 'created',
		header: 'Created',
		meta: { width: COLUMN_WIDTH.created, visibleFrom: 'lg' },
		cell: ({ getValue }) => timestampCell(getValue()),
	}),
	column.display({
		id: 'actions',
		header: 'Actions',
		meta: { variant: 'actions' },
		cell: ({ row }) => renderSnippet(actionsCell, row.original),
	}),
]);
</script>

{#snippet nameCell(volume: VolumeDto)}
	<span class="flex min-w-0 items-baseline gap-2">
		<span class="min-w-0 truncate text-(--text-primary)">{volume.name}</span>
		<span class="shrink-0 font-mono text-(--text-subtle) text-xs max-md:hidden">
			{volume.id.slice(0, VOLUME_ID_PREVIEW_CHARACTERS)}
		</span>
	</span>
{/snippet}

{#snippet stateCell(volume: VolumeDto)}
	<ResourceStateBadge errorReason={volume.errorReason} state={volume.state} />
{/snippet}

{#snippet actionsCell(volume: VolumeDto)}
	<ResourceRowActions
		label={`Actions for ${volume.name}`}
		actions={rowActions(volume)}
	/>
{/snippet}

<ResourceDataTable
	caption="Volumes"
	{columns}
	data={volumes}
	getRowId={(volume) => volume.id}
	rowLabel={(volume) => volume.name}
	{sortConfig}
	sortedByServer
	{pagination}
	{footer}
	{isLoading}
	errorMessage={isError ? "Couldn't load volumes" : undefined}
	{onRetry}
	{empty}
	selectedRowId={openVolumeId}
	onRowClick={onOpen}
	rowContextMenu
	selection={selectable
		? { selectedRowIds, onChange: (ids) => (selectedRowIds = ids) }
		: undefined}
	{bulkActions}
	{onDeleteSelection}
/>
