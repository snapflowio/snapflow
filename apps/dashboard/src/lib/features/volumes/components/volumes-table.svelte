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
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';

export const VOLUME_COLUMN_LABELS = [
	'Name',
	'State',
	'Size',
	'Last used',
	'Created',
];

interface VolumesTableProps {
	volumes: readonly VolumeDto[];
	isError: boolean;
	onRetry: () => void;
	selectable: boolean;
	selectedRowIds?: string[];
	rowActions: (volume: VolumeDto) => readonly ResourceRowAction[];
	bulkActions: readonly ResourceBulkAction[];
	onDeleteSelection?: (ids: string[]) => void;
	empty: Snippet;
}
</script>

<script lang="ts">
import Database from '@lucide/svelte/icons/database';
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

let {
	volumes,
	isError,
	onRetry,
	selectable,
	selectedRowIds = $bindable([]),
	rowActions,
	bulkActions,
	onDeleteSelection,
	empty,
}: VolumesTableProps = $props();

const column = resourceColumnHelper<VolumeDto>();
const dataColumns: ResourceColumnDefs<VolumeDto> = [
	column.accessor('name', {
		header: 'Name',
		cell: ({ row }) =>
			resourceCell(
				{ icon: volumeIcon, label: row.original.name },
				row.original
			),
	}),
	column.accessor('state', {
		header: 'State',
		cell: ({ row }) => renderSnippet(stateBadge, row.original),
	}),
	column.accessor('sizeGiB', {
		id: 'size',
		header: 'Size',
		cell: ({ getValue }) => resourceTextCell({ label: `${getValue()} GiB` }),
	}),
	column.accessor('lastUsedAt', {
		id: 'lastUsed',
		header: 'Last used',
		cell: ({ getValue }) => {
			const lastUsedAt = getValue();
			return resourceTextCell(
				lastUsedAt ? timeCell(lastUsedAt) : { label: 'Never' }
			);
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
const columns = $derived<ResourceColumnDefs<VolumeDto>>(
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

{#snippet volumeIcon()}
	<Database />
{/snippet}

{#snippet stateBadge(
	volume: VolumeDto
)}
	<ResourceStateBadge errorReason={volume.errorReason} state={volume.state} />
{/snippet}

{#snippet actionsCell(
	volume: VolumeDto
)}
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
	errorMessage={isError ? 'Failed to load volumes' : undefined}
	{onRetry}
	{empty}
	selection={selectable
		? {
				selectedRowIds,
				onChange: (ids) => (selectedRowIds = ids),
			}
		: undefined}
	{bulkActions}
	{onDeleteSelection}
/>
