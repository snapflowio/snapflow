<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { ExposureCutoverDto } from '@snapflow/api-client';
import { renderSnippet } from '@tanstack/svelte-table';
import Resource from '#lib/components/resource/resource.svelte';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
import ResourceRowContextMenu from '#lib/components/resource/resource-row-context-menu.svelte';
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import { resourceColumnHelper } from '#lib/components/resource/table/resource-table-model.ts';
import {
	copyableCell,
	timestampCell,
} from '#lib/components/resource/table/rich-cells.ts';
import TableFooter from '#lib/components/resource/table/table-footer.svelte';
import ChipModalConfirmTarget from '#lib/components/ui/chip-modal/chip-modal-confirm-target.svelte';
import AdminTableEmpty from '#lib/features/admin/components/shared/admin-table-empty.svelte';
import AdminToolbar from '#lib/features/admin/components/shared/admin-toolbar.svelte';
import {
	GROW_COLUMN,
	NAME_COLUMN,
	STATUS_COLUMN,
	TIME_COLUMN,
} from '#lib/features/admin/lib/admin-columns.ts';
import { adminTableError } from '#lib/features/admin/lib/admin-load-error.ts';
import { cutoverConfirmCopy } from '#lib/features/admin/lib/cutovers-list.ts';
import { CutoversList } from '#lib/features/admin/state/cutovers-list.svelte.ts';
import { countLabel } from '#lib/utils/format.ts';

const list = new CutoversList();

const column = resourceColumnHelper<ExposureCutoverDto>();
const columns = [
	column.accessor('exposureId', {
		id: 'exposure',
		header: 'Exposure',
		meta: NAME_COLUMN,
		cell: ({ getValue }) => copyableCell(getValue(), 'Copy exposure ID'),
	}),
	column.accessor('state', {
		id: 'state',
		header: 'State',
		meta: STATUS_COLUMN,
		cell: ({ row }) => renderSnippet(stateCell, row.original),
	}),
	column.accessor('predecessorEdgeId', {
		id: 'from',
		header: 'From edge',
		meta: GROW_COLUMN,
		cell: ({ getValue }) => copyableCell(getValue(), 'Copy edge ID'),
	}),
	column.accessor('edgeId', {
		id: 'to',
		header: 'To edge',
		meta: GROW_COLUMN,
		cell: ({ getValue }) => copyableCell(getValue(), 'Copy edge ID'),
	}),
	column.accessor((cutover) => cutover.startedAt ?? '', {
		id: 'started',
		header: 'Started',
		meta: { ...TIME_COLUMN, visibleFrom: 'lg' },
		cell: ({ row }) => timestampCell(row.original.startedAt),
	}),
	column.accessor((cutover) => cutover.verifiedAt ?? '', {
		id: 'verified',
		header: 'Verified',
		meta: { ...TIME_COLUMN, visibleFrom: 'xl' },
		cell: ({ row }) => timestampCell(row.original.verifiedAt),
	}),
	column.display({
		id: 'actions',
		header: 'Actions',
		meta: { variant: 'actions' },
		cell: ({ row }) => renderSnippet(actionsCell, row.original),
	}),
];
</script>

{#snippet stateCell(cutover: ExposureCutoverDto)}
	<ResourceStateBadge state={cutover.state} />
{/snippet}

{#snippet actionsCell(cutover: ExposureCutoverDto)}
	<ResourceRowActions
		label={`${cutover.exposureId} actions`}
		actions={list.cutoverActions(cutover)}
	/>
{/snippet}

{#snippet emptyState()}
	<AdminTableEmpty
		message="No edge cutovers in progress"
		resource="cutovers"
		search={list.controls.search.value}
		filterCount={list.controls.filterCount}
		onClear={list.controls.clearSearchAndFilters}
	/>
{/snippet}

<Resource>
	<AdminToolbar
		title="Edge cutovers"
		controls={list.controls}
		searchPlaceholder="Search cutovers"
	/>
	<ResourceRowContextMenu
		actionsFor={(rowId) =>
			rowId === null ? [] : list.cutoverRowActions(rowId)}
	>
		<ResourceDataTable
			caption="Edge cutovers"
			{columns}
			data={list.cutovers}
			getRowId={(cutover) => cutover.backendId}
			rowLabel={(cutover) => cutover.exposureId}
			sort={list.controls.sort}
			sortConfig={list.controls.sortConfig}
			isLoading={list.cutoversQuery.isLoading}
			isFetching={list.cutoversQuery.isRefetching}
			errorMessage={adminTableError(list.cutoversQuery.error, 'cutovers')}
			empty={emptyState}
			onRetry={() => void list.cutoversQuery.refetch()}
			rowContextMenu
		/>
	</ResourceRowContextMenu>
	<TableFooter label={countLabel(list.cutovers.length, 'cutover')} />
</Resource>
<ChipModalConfirmTarget
	target={list.pending}
	{...cutoverConfirmCopy(list.pending)}
	pending={list.runAction.isPending}
	destructive={list.pending?.action === 'rollback'}
	onCancel={list.cancelAction}
	onConfirm={list.confirmAction}
/>
