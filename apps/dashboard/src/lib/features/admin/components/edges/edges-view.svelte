<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { EdgeDto } from '@snapflow/api-client';
import { renderSnippet } from '@tanstack/svelte-table';
import CredentialsModal from '#lib/components/credentials-modal.svelte';
import Connections from '#lib/components/icons/connections.svelte';
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
import {
	deleteEdgeCopy,
	NEVER_HEARTBEAT_LABEL,
} from '#lib/features/admin/lib/edges-list.ts';
import { EdgesList } from '#lib/features/admin/state/edges-list.svelte.ts';

const list = new EdgesList();

const column = resourceColumnHelper<EdgeDto>();
const columns = [
	column.accessor('name', {
		id: 'name',
		header: 'Name',
		cell: ({ row }) =>
			renderResourceLabel({
				icon: connectionsIcon,
				label: row.original.name,
				sublabel: row.original.publicHost,
			}),
	}),
	column.accessor('status', {
		id: 'status',
		header: 'Status',
		cell: ({ row }) => renderSnippet(statusCell, row.original),
	}),
	column.accessor((edge) => edge.supportedProtocols.join(', '), {
		id: 'protocols',
		header: 'Protocols',
		cell: ({ getValue }) => renderResourceLabel({ label: getValue() }),
	}),
	column.accessor((edge) => edge.lastHeartbeatAt ?? '', {
		id: 'heartbeat',
		header: 'Last heartbeat',
		cell: ({ row }) =>
			renderResourceLabel(
				row.original.lastHeartbeatAt
					? timeCell(row.original.lastHeartbeatAt)
					: { label: NEVER_HEARTBEAT_LABEL }
			),
	}),
	column.display({
		id: 'actions',
		header: 'Actions',
		meta: { variant: 'actions' },
		cell: ({ row }) => renderSnippet(actionsCell, row.original),
	}),
];
</script>

{#snippet connectionsIcon()}
	<Connections />
{/snippet}

{#snippet statusCell(
	edge: EdgeDto
)}
	<ResourceStateBadge state={edge.status} />
{/snippet}

{#snippet actionsCell(
	edge: EdgeDto
)}
	<ResourceRowActions
		label={`${edge.name} actions`}
		actions={list.edgeActions(edge)}
	/>
{/snippet}

{#snippet emptyState()}
	<AdminListEmpty
		search={list.controls.search.value}
		filterCount={list.controls.filterTags.length}
		onClear={list.controls.clearSearchAndFilters}
		title="Edges"
		description="Edges appear here once they enroll with the control plane."
	/>
{/snippet}

<Resource>
	<ResourceHeader icon={Connections} title="Edges" />
	<AdminListOptionsBar
		controls={list.controls}
		placeholder="Search edges..."
		ariaLabel="Search edges"
	/>
	<AdminTableContextMenu rowActions={list.edgeRowActions}>
		<ResourceDataTable
			caption="Edges"
			{columns}
			data={list.edges}
			getRowId={(edge) => edge.id}
			rowLabel={(edge) => edge.name}
			sort={list.controls.sort}
			isLoading={list.edgesQuery.isLoading}
			empty={emptyState}
			onRetry={() => void list.edgesQuery.refetch()}
			onRowContextMenu={() => {}}
			{...adminTableErrorProps(list.edgesQuery.error, 'Failed to load edges')}
		/>
	</AdminTableContextMenu>
</Resource>
<CredentialsModal credentials={list.secret} onClose={list.closeSecret} />
<ChipModalConfirmTarget
	target={list.deleting}
	{...deleteEdgeCopy(list.deleting)}
	pending={list.deleteMutation.isPending}
	onCancel={list.cancelDelete}
	onConfirm={list.confirmDelete}
/>
