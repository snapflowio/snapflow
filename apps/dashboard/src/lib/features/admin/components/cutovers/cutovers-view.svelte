<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import RefreshCw from '@lucide/svelte/icons/refresh-cw';
import type { ExposureCutoverDto } from '@snapflow/api-client';
import { renderSnippet } from '@tanstack/svelte-table';
import Resource from '#lib/components/resource/resource.svelte';
import ResourceHeader from '#lib/components/resource/resource-header.svelte';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import { renderResourceLabel } from '#lib/components/resource/table/resource-cell.ts';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import { resourceColumnHelper } from '#lib/components/resource/table/resource-table-model.ts';
import { timeCell } from '#lib/components/resource/table/time-cell.ts';
import ChipModalConfirmTarget from '#lib/components/ui/chip-modal/chip-modal-confirm-target.svelte';
import AdminListEmpty from '#lib/features/admin/components/admin-list-empty.svelte';
import AdminListOptionsBar from '#lib/features/admin/components/admin-list-options-bar.svelte';
import AdminTableContextMenu from '#lib/features/admin/components/admin-table-context-menu.svelte';
import { adminTableErrorProps } from '#lib/features/admin/components/admin-table-error.svelte';
import { cutoverConfirmCopy } from '#lib/features/admin/lib/cutovers-list.ts';
import { CutoversList } from '#lib/features/admin/state/cutovers-list.svelte.ts';

const list = new CutoversList();

const column = resourceColumnHelper<ExposureCutoverDto>();
const columns = [
	column.accessor('exposureId', {
		id: 'exposure',
		header: 'Exposure',
		cell: ({ row }) =>
			renderResourceLabel({
				icon: refreshIcon,
				label: row.original.exposureId,
				sublabel: `Backend ${row.original.backendId}`,
			}),
	}),
	column.accessor('state', {
		id: 'state',
		header: 'State',
		cell: ({ row }) => renderSnippet(stateCell, row.original),
	}),
	column.accessor(
		(cutover) => `${cutover.predecessorEdgeId} → ${cutover.edgeId}`,
		{
			id: 'edges',
			header: 'Edge move',
			cell: ({ getValue }) => renderResourceLabel({ label: getValue() }),
		}
	),
	column.accessor((cutover) => cutover.startedAt ?? '', {
		id: 'started',
		header: 'Started',
		cell: ({ row }) => renderResourceLabel(timeCell(row.original.startedAt)),
	}),
	column.accessor((cutover) => cutover.verifiedAt ?? '', {
		id: 'verified',
		header: 'Verified',
		cell: ({ row }) => renderResourceLabel(timeCell(row.original.verifiedAt)),
	}),
	column.display({
		id: 'actions',
		header: 'Actions',
		meta: { variant: 'actions' },
		cell: ({ row }) => renderSnippet(actionsCell, row.original),
	}),
];
</script>

{#snippet refreshIcon()}
	<RefreshCw />
{/snippet}

{#snippet stateCell(
	cutover: ExposureCutoverDto
)}
	<ResourceStateBadge state={cutover.state} />
{/snippet}

{#snippet actionsCell(
	cutover: ExposureCutoverDto
)}
	<ResourceRowActions
		label={`${cutover.exposureId} actions`}
		actions={list.cutoverActions(cutover)}
	/>
{/snippet}

{#snippet emptyState()}
	<AdminListEmpty
		search={list.controls.search.value}
		filterCount={list.controls.filterTags.length}
		onClear={list.controls.clearSearchAndFilters}
		title="Edge cutovers"
		description="Exposures waiting to move to a new edge appear here once the edge acknowledges them."
	/>
{/snippet}

<Resource>
	<ResourceHeader icon={RefreshCw} title="Edge cutovers" />
	<AdminListOptionsBar
		controls={list.controls}
		placeholder="Search cutovers..."
		ariaLabel="Search cutovers"
	/>
	<AdminTableContextMenu rowActions={list.cutoverRowActions}>
		<ResourceDataTable
			caption="Edge cutovers"
			{columns}
			data={list.cutovers}
			getRowId={(cutover) => cutover.backendId}
			rowLabel={(cutover) => cutover.exposureId}
			sort={list.controls.sort}
			isLoading={list.cutoversQuery.isLoading}
			empty={emptyState}
			onRetry={() => void list.cutoversQuery.refetch()}
			onRowContextMenu={() => {}}
			{...adminTableErrorProps(
				list.cutoversQuery.error,
				'Failed to load cutovers'
			)}
		/>
	</AdminTableContextMenu>
</Resource>
<ChipModalConfirmTarget
	target={list.pending}
	{...cutoverConfirmCopy(list.pending)}
	pending={list.runAction.isPending}
	destructive={list.pending?.action === 'rollback'}
	onCancel={list.cancelAction}
	onConfirm={list.confirmAction}
/>
