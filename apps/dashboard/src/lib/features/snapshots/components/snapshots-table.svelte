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
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';

const SIZE_FRACTION_DIGITS = 1;

export const SNAPSHOT_COLUMN_LABELS = [
	'Name',
	'State',
	'Image',
	'Resources',
	'Size',
	'Created',
] as const;

interface SnapshotsTableProps {
	snapshots: readonly SnapshotDto[];
	isError: boolean;
	onRetry: () => void;
	selectable: boolean;
	selectedRowIds?: string[];
	openSnapshotId: string | null;
	onOpen: (snapshotId: string) => void;
	rowActions: (snapshot: SnapshotDto) => readonly ResourceRowAction[];
	bulkActions: readonly ResourceBulkAction[];
	onDeleteSelection?: (ids: string[]) => void;
	empty: Snippet;
	overlay: Snippet;
}
</script>

<script lang="ts">
import ImageUp from '@lucide/svelte/icons/image';
import { renderSnippet } from '@tanstack/svelte-table';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
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
import { formatGibibytes } from '#lib/utils/format.ts';

let {
	snapshots,
	isError,
	onRetry,
	selectable,
	selectedRowIds = $bindable([]),
	openSnapshotId,
	onOpen,
	rowActions,
	bulkActions,
	onDeleteSelection,
	empty,
	overlay,
}: SnapshotsTableProps = $props();

const column = resourceColumnHelper<SnapshotDto>();
const dataColumns: ResourceColumnDefs<SnapshotDto> = [
	column.accessor('name', {
		header: 'Name',
		cell: ({ row }) =>
			resourceCell({ icon: nameIcon, label: row.original.name }, row.original),
	}),
	column.accessor('state', {
		header: 'State',
		cell: ({ row }) => renderSnippet(stateCell, row.original),
	}),
	column.accessor('imageName', {
		id: 'image',
		header: 'Image',
		cell: ({ getValue }) => resourceTextCell({ label: getValue() }),
	}),
	column.display({
		id: 'resources',
		header: 'Resources',
		cell: ({ row }) =>
			resourceTextCell({
				label: `${row.original.cpu} CPU · ${row.original.mem} GiB`,
			}),
	}),
	column.accessor('size', {
		header: 'Size',
		cell: ({ getValue }) => {
			const size = getValue();
			return resourceTextCell({
				label:
					size === null ? null : formatGibibytes(size, SIZE_FRACTION_DIGITS),
			});
		},
	}),
	column.accessor('createdAt', {
		id: 'created',
		header: 'Created',
		cell: ({ getValue }) => resourceTextCell(timeCell(getValue())),
	}),
	column.display({
		id: 'actions',
		header: 'Actions',
		meta: { variant: 'actions' },
		cell: ({ row }) => renderSnippet(actionsCell, row.original),
	}),
];
const columns = $derived<ResourceColumnDefs<SnapshotDto>>(
	selectable
		? [
				column.display({
					id: 'selection',
					header: 'Select',
					meta: { variant: 'selection' },
				}),
				...dataColumns,
			]
		: dataColumns
);
</script>

{#snippet nameIcon()}
	<ImageUp />
{/snippet}

{#snippet stateCell(
	snapshot: SnapshotDto
)}
	<ResourceStateBadge
		errorReason={snapshot.errorReason}
		state={snapshot.state}
	/>
{/snippet}

{#snippet actionsCell(
	snapshot: SnapshotDto
)}
	<ResourceRowActions
		label={`Actions for ${snapshot.name}`}
		actions={rowActions(snapshot)}
	/>
{/snippet}

<ResourceDataTable
	caption="Snapshots"
	{columns}
	data={snapshots}
	getRowId={(snapshot) => snapshot.id}
	rowLabel={(snapshot) => snapshot.name}
	errorMessage={isError ? 'Failed to load snapshots' : undefined}
	{onRetry}
	{empty}
	{overlay}
	selectedRowId={openSnapshotId}
	onRowClick={onOpen}
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
