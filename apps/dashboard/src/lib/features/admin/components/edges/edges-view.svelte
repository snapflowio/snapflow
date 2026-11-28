<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Plus from '@lucide/svelte/icons/plus';
import type { EdgeDto } from '@snapflow/api-client';
import { renderSnippet } from '@tanstack/svelte-table';
import CredentialsModal from '#lib/components/credentials-modal.svelte';
import Resource from '#lib/components/resource/resource.svelte';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
import ResourceRowContextMenu from '#lib/components/resource/resource-row-context-menu.svelte';
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import { renderResourceLabel } from '#lib/components/resource/table/resource-cell.ts';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import { resourceColumnHelper } from '#lib/components/resource/table/resource-table-model.ts';
import { timestampCell } from '#lib/components/resource/table/rich-cells.ts';
import TableFooter from '#lib/components/resource/table/table-footer.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModalConfirmTarget from '#lib/components/ui/chip-modal/chip-modal-confirm-target.svelte';
import CreateEdgeModal from '#lib/features/admin/components/edges/create-edge-modal.svelte';
import AdminTableEmpty from '#lib/features/admin/components/shared/admin-table-empty.svelte';
import AdminToolbar from '#lib/features/admin/components/shared/admin-toolbar.svelte';
import {
	GROW_COLUMN,
	NAME_COLUMN,
	STATUS_COLUMN,
	TIME_COLUMN,
} from '#lib/features/admin/lib/admin-columns.ts';
import { adminTableError } from '#lib/features/admin/lib/admin-load-error.ts';
import {
	deleteEdgeCopy,
	edgeConfirmCopy,
	NEVER_HEARTBEAT_LABEL,
} from '#lib/features/admin/lib/edges-list.ts';
import { EdgesList } from '#lib/features/admin/state/edges-list.svelte.ts';
import { countLabel } from '#lib/utils/format.ts';

const list = new EdgesList();

const column = resourceColumnHelper<EdgeDto>();
const columns = [
	column.accessor('name', {
		id: 'name',
		header: 'Name',
		meta: NAME_COLUMN,
		cell: ({ row }) =>
			renderResourceLabel({
				label: row.original.name,
				sublabel: row.original.publicHost,
			}),
	}),
	column.accessor('status', {
		id: 'status',
		header: 'Status',
		meta: STATUS_COLUMN,
		cell: ({ row }) => renderSnippet(statusCell, row.original),
	}),
	column.accessor((edge) => edge.supportedProtocols.join(', '), {
		id: 'protocols',
		header: 'Protocols',
		meta: GROW_COLUMN,
		cell: ({ getValue }) => renderResourceLabel({ label: getValue() }),
	}),
	column.accessor((edge) => edge.lastHeartbeatAt ?? '', {
		id: 'heartbeat',
		header: 'Last heartbeat',
		meta: TIME_COLUMN,
		cell: ({ row }) =>
			timestampCell(row.original.lastHeartbeatAt, NEVER_HEARTBEAT_LABEL),
	}),
	column.display({
		id: 'actions',
		header: 'Actions',
		meta: { variant: 'actions' },
		cell: ({ row }) => renderSnippet(actionsCell, row.original),
	}),
];
</script>

{#snippet statusCell(edge: EdgeDto)}
	<ResourceStateBadge state={edge.status} />
{/snippet}

{#snippet actionsCell(edge: EdgeDto)}
	<ResourceRowActions
		label={`${edge.name} actions`}
		actions={list.edgeActions(edge)}
	/>
{/snippet}

{#snippet createControl()}
	<Chip
		variant="secondary"
		size="compact"
		leftIcon={Plus}
		onclick={() => {
			list.creating = true;
		}}
	>
		New edge
	</Chip>
{/snippet}

{#snippet emptyState()}
	<AdminTableEmpty
		message="No edges enrolled yet"
		resource="edges"
		search={list.controls.search.value}
		filterCount={list.controls.filterCount}
		onClear={list.controls.clearSearchAndFilters}
	/>
{/snippet}

<Resource>
	<AdminToolbar
		title="Edges"
		controls={list.controls}
		searchPlaceholder="Search edges"
		trailing={createControl}
	/>
	<ResourceRowContextMenu
		actionsFor={(rowId) => (rowId === null ? [] : list.edgeRowActions(rowId))}
	>
		<ResourceDataTable
			caption="Edges"
			{columns}
			data={list.edges}
			getRowId={(edge) => edge.id}
			rowLabel={(edge) => edge.name}
			sort={list.controls.sort}
			sortConfig={list.controls.sortConfig}
			isLoading={list.edgesQuery.isLoading}
			isFetching={list.edgesQuery.isRefetching}
			errorMessage={adminTableError(list.edgesQuery.error, 'edges')}
			empty={emptyState}
			onRetry={() => void list.edgesQuery.refetch()}
			rowContextMenu
		/>
	</ResourceRowContextMenu>
	<TableFooter label={countLabel(list.edges.length, 'edge')} />
</Resource>
<CreateEdgeModal bind:open={list.creating} onCreated={list.showCreated} />
<CredentialsModal credentials={list.secret} onClose={list.closeSecret} />
<ChipModalConfirmTarget
	target={list.confirming}
	{...edgeConfirmCopy(list.confirming)}
	pending={list.confirmPending}
	onCancel={list.cancelConfirmation}
	onConfirm={list.confirmAction}
/>
<ChipModalConfirmTarget
	target={list.deleting}
	{...deleteEdgeCopy(list.deleting)}
	pending={list.deleteMutation.isPending}
	friction="type-name"
	confirmName={list.deleting?.name}
	onCancel={list.cancelDelete}
	onConfirm={list.confirmDelete}
/>
