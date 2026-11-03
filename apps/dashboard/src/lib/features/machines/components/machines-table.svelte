<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { Machine } from '@snapflow/api-client';
import type { Snippet } from 'svelte';
import type { ResourceBulkAction } from '#lib/components/resource/resource-bulk-action-bar.svelte';
import type { ResourceSortState } from '#lib/components/resource/table/resource-table-sort.ts';
import type { MachineActionHandlers } from '#lib/features/machines/lib/machine-row-actions.ts';

interface MachinesTableProps extends Omit<MachineActionHandlers, 'onOpen'> {
	machines: readonly Machine[];
	isLoading: boolean;
	errorMessage?: string;
	errorAction?: Snippet;
	onRetry: () => void;
	onSelect?: (machine: Machine) => void;
	onRowContextMenu?: (event: MouseEvent, machineId: string) => void;
	sort?: ResourceSortState;
	selectable?: boolean;
	selectedRowIds?: string[];
	bulkActions?: readonly ResourceBulkAction[];
	onDeleteSelection?: (ids: string[]) => void;
	empty?: Snippet;
}
</script>

<script lang="ts">
import ServerIcon from '@lucide/svelte/icons/server';
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
import Badge from '#lib/components/ui/badge.svelte';
import { locationLabel } from '#lib/features/locations/lib/location-format.ts';
import {
	machineSchedulingLabel,
	machineServiceState,
} from '#lib/features/machines/lib/machine-format.ts';
import { machineRowActions } from '#lib/features/machines/lib/machine-row-actions.ts';

let {
	machines,
	isLoading,
	errorMessage,
	errorAction,
	onRetry,
	onSelect,
	onRowContextMenu,
	sort,
	selectable = false,
	selectedRowIds = $bindable([]),
	bulkActions = [],
	onDeleteSelection,
	empty,
	onToggleScheduling,
	onDrainingChange,
	onRevokeIdentity,
	onDelete,
}: MachinesTableProps = $props();

const column = resourceColumnHelper<Machine>();
const columns: ResourceColumnDefs<Machine> = $derived([
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
		cell: ({ row }) =>
			resourceCell(
				{
					icon: serverIcon,
					label: row.original.name,
					sublabel: row.original.appVersion ?? `API ${row.original.apiVersion}`,
				},
				row.original
			),
	}),
	column.accessor('state', {
		header: 'State',
		cell: ({ row }) => renderSnippet(stateCell, row.original),
	}),
	column.accessor((machine) => locationLabel(machine.location), {
		id: 'location',
		header: 'Location',
		cell: ({ getValue }) => resourceTextCell({ label: getValue() }),
	}),
	column.display({
		id: 'capacity',
		header: 'Capacity',
		cell: ({ row }) =>
			resourceTextCell({
				label: `${row.original.cpu} vCPU · ${row.original.memory} GiB`,
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
		cell: ({ getValue }) => {
			const lastChecked = getValue();
			return resourceTextCell(
				lastChecked ? timeCell(lastChecked) : { label: 'Never' }
			);
		},
	}),
	column.display({
		id: 'actions',
		header: 'Actions',
		meta: { variant: 'actions' },
		cell: ({ row }) => renderSnippet(actionsCell, row.original),
	}),
]);
const machinesById = $derived(
	new Map(machines.map((machine) => [machine.id, machine]))
);

function selectRow(machineId: string): void {
	const machine = machinesById.get(machineId);
	if (machine) onSelect?.(machine);
}
</script>

{#snippet serverIcon()}
	<ServerIcon class="size-3.5" />
{/snippet}

{#snippet stateCell(
	machine: Machine
)}
	<ResourceStateBadge
		state={machine.state}
		errorReason={machine.readinessReason}
	/>
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
		label={`Actions for ${machine.name}`}
		actions={machineRowActions(machine, {
			onOpen: onSelect,
			onToggleScheduling,
			onDrainingChange,
			onRevokeIdentity,
			onDelete,
		})}
	/>
{/snippet}

<ResourceDataTable
	caption="Machines"
	{columns}
	data={machines}
	getRowId={(machine) => machine.id}
	rowLabel={(machine) => machine.name}
	{sort}
	{isLoading}
	{errorMessage}
	{errorAction}
	{onRetry}
	{empty}
	emptyMessage="No machines registered"
	onRowClick={onSelect ? selectRow : undefined}
	{onRowContextMenu}
	selection={selectable
		? { selectedRowIds, onChange: (ids) => (selectedRowIds = ids) }
		: undefined}
	{bulkActions}
	{onDeleteSelection}
/>
