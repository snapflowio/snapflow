<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ServerIcon from '@lucide/svelte/icons/server';
import type { Machine } from '@snapflow/api-client';
import { renderSnippet } from '@tanstack/svelte-table';
import Resource from '#lib/components/resource/resource.svelte';
import ResourceHeader from '#lib/components/resource/resource-header.svelte';
import ResourceRefreshControl from '#lib/components/resource/resource-refresh-control.svelte';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import { renderResourceLabel } from '#lib/components/resource/table/resource-cell.ts';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import { resourceColumnHelper } from '#lib/components/resource/table/resource-table-model.ts';
import { timeCell } from '#lib/components/resource/table/time-cell.ts';
import Badge from '#lib/components/ui/badge.svelte';
import ChipModalConfirmTarget from '#lib/components/ui/chip-modal/chip-modal-confirm-target.svelte';
import AdminListEmpty from '#lib/features/admin/components/admin-list-empty.svelte';
import AdminListOptionsBar from '#lib/features/admin/components/admin-list-options-bar.svelte';
import AdminTableContextMenu from '#lib/features/admin/components/admin-table-context-menu.svelte';
import { adminTableErrorProps } from '#lib/features/admin/components/admin-table-error.svelte';
import {
	decommissionMachineCopy,
	deleteAdminMachineCopy,
	NEVER_CHECKED,
} from '#lib/features/admin/lib/machines-list.ts';
import { AdminMachinesList } from '#lib/features/admin/state/machines-list.svelte.ts';
import { locationLabel } from '#lib/features/locations/lib/location-format.ts';
import {
	machineSchedulingLabel,
	machineServiceState,
} from '#lib/features/machines/lib/machine-format.ts';

const list = new AdminMachinesList();

const column = resourceColumnHelper<Machine>();
const columns = [
	column.accessor('name', {
		id: 'name',
		header: 'Name',
		cell: ({ row }) =>
			renderResourceLabel({
				icon: serverIcon,
				label: row.original.name,
				sublabel: row.original.appVersion ?? `API ${row.original.apiVersion}`,
			}),
	}),
	column.accessor('state', {
		id: 'state',
		header: 'State',
		cell: ({ row }) => renderSnippet(stateCell, row.original),
	}),
	column.accessor((machine) => locationLabel(machine.location), {
		id: 'location',
		header: 'Location',
		cell: ({ getValue }) => renderResourceLabel({ label: getValue() }),
	}),
	column.display({
		id: 'capacity',
		header: 'Capacity',
		cell: ({ row }) =>
			renderResourceLabel({
				label: `${row.original.cpu} CPU · ${row.original.memory} GiB`,
			}),
	}),
	column.display({
		id: 'services',
		header: 'Services',
		cell: ({ row }) => renderSnippet(servicesCell, row.original),
	}),
	column.display({
		id: 'scheduling',
		header: 'Scheduling',
		cell: ({ row }) => renderSnippet(schedulingCell, row.original),
	}),
	column.accessor((machine) => machine.lastChecked ?? '', {
		id: 'checked',
		header: 'Last checked',
		cell: ({ row }) =>
			renderResourceLabel(
				row.original.lastChecked
					? timeCell(row.original.lastChecked)
					: { label: NEVER_CHECKED }
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

{#snippet serverIcon()}
	<ServerIcon />
{/snippet}

{#snippet stateCell(
	machine: Machine
)}
	<ResourceStateBadge state={machine.state} />
{/snippet}

{#snippet servicesCell(
	machine: Machine
)}
	<ResourceStateBadge state={machineServiceState(machine)} />
{/snippet}

{#snippet schedulingCell(
	machine: Machine
)}
	<Badge size="sm" variant={machine.unschedulable ? 'amber' : 'green'}>
		{machineSchedulingLabel(machine)}
	</Badge>
{/snippet}

{#snippet actionsCell(
	machine: Machine
)}
	<ResourceRowActions
		label={`${machine.name} actions`}
		actions={list.machineActions(machine)}
	/>
{/snippet}

{#snippet refreshControl()}
	<ResourceRefreshControl
		isRefreshing={list.machinesQuery.isFetching}
		onIntervalChange={list.setRefreshInterval}
		onRefresh={() => void list.machinesQuery.refetch()}
		value={list.refreshInterval}
	/>
{/snippet}

{#snippet emptyState()}
	<AdminListEmpty
		search={list.controls.search.value}
		filterCount={list.controls.filterTags.length}
		onClear={list.controls.clearSearchAndFilters}
		title="Machines"
		description="Every machine enrolled by any host appears here."
	/>
{/snippet}

<Resource>
	<ResourceHeader
		icon={ServerIcon}
		title="Machines"
		trailing={refreshControl}
	/>
	<AdminListOptionsBar
		controls={list.controls}
		placeholder="Search machines..."
		ariaLabel="Search machines"
	/>
	<AdminTableContextMenu rowActions={list.machineRowActions}>
		<ResourceDataTable
			caption="Machines"
			{columns}
			data={list.machines}
			getRowId={(machine) => machine.id}
			rowLabel={(machine) => machine.name}
			sort={list.controls.sort}
			isLoading={list.machinesQuery.isLoading}
			empty={emptyState}
			onRetry={() => void list.machinesQuery.refetch()}
			onRowContextMenu={() => {}}
			{...adminTableErrorProps(
				list.machinesQuery.error,
				'Failed to load machines'
			)}
		/>
	</AdminTableContextMenu>
</Resource>
<ChipModalConfirmTarget
	target={list.decommissioning}
	{...decommissionMachineCopy(list.decommissioning)}
	pending={list.drainingMutation.isPending}
	onCancel={list.cancelDecommission}
	onConfirm={list.decommission}
/>
<ChipModalConfirmTarget
	target={list.deleting}
	{...deleteAdminMachineCopy(list.deleting)}
	pending={list.deleteMutation.isPending}
	onCancel={list.cancelDelete}
	onConfirm={list.confirmDelete}
/>
