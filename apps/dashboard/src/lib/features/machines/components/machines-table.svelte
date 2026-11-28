<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { HostMachine, Machine } from '@snapflow/api-client';
import type { Snippet } from 'svelte';
import type { ResourceBulkAction } from '#lib/components/resource/resource-bulk-action-bar.svelte';
import type { ResourceSortConfig } from '#lib/components/resource/resource-options.ts';
import type { MachineActionHandlers } from '#lib/features/machines/lib/machine-row-actions.ts';

interface MachinesTableProps extends Omit<MachineActionHandlers, 'onOpen'> {
	machines: readonly Machine[];
	hosts: ReadonlyMap<string, HostMachine>;
	earned: ReadonlyMap<string, string>;
	showsListing: boolean;
	showsEarnings: boolean;
	isLoading: boolean;
	isFetching: boolean;
	errorMessage?: string;
	onRetry: () => void;
	onSelect?: (machine: Machine) => void;
	onOpenHealth: (machine: Machine) => void;
	onRowContextMenu?: (event: MouseEvent, machineId: string) => void;
	sortConfig?: ResourceSortConfig;
	selectable?: boolean;
	selectedRowIds?: string[];
	bulkActions?: readonly ResourceBulkAction[];
	onDeleteSelection?: (ids: string[]) => void;
	empty?: Snippet;
}
</script>

<script lang="ts">
import Activity from '@lucide/svelte/icons/activity';
import { renderSnippet } from '@tanstack/svelte-table';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import { QUICK_ACTION_COLUMN_PX } from '#lib/components/resource/table/resource-table.ts';
import {
	type ResourceColumnDefs,
	resourceColumnHelper,
} from '#lib/components/resource/table/resource-table-model.ts';
import { machineRowActions } from '#lib/features/machines/lib/machine-row-actions.ts';
import {
	type MachineHostData,
	machineCapacityColumn,
	machineCheckedColumn,
	machineEarnedColumn,
	machineListingColumn,
	machineLocationColumn,
	machineNameColumn,
	machinePriceColumn,
	machineStateColumn,
} from '#lib/features/machines/lib/machine-table-columns.ts';

let {
	machines,
	hosts,
	earned,
	showsListing,
	showsEarnings,
	isLoading,
	isFetching,
	errorMessage,
	onRetry,
	onSelect,
	onOpenHealth,
	onRowContextMenu,
	sortConfig,
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

const SHORT_ID_LENGTH = 8;

const column = resourceColumnHelper<Machine>();
const hostData: MachineHostData = $derived({
	host: (machineId) => hosts.get(machineId),
	earnedMicroUsd: (machineId) => earned.get(machineId),
});
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
	machineNameColumn((machine) => machine.id.slice(0, SHORT_ID_LENGTH)),
	machineStateColumn(),
	...(showsListing ? [machineListingColumn(hostData, 'md')] : []),
	machineLocationColumn('xl'),
	machineCapacityColumn('md'),
	...(showsListing ? [machinePriceColumn(hostData, 'xl')] : []),
	...(showsEarnings ? [machineEarnedColumn(hostData, 'lg')] : []),
	machineCheckedColumn('2xl'),
	column.display({
		id: 'actions',
		header: 'Actions',
		meta: { variant: 'actions', width: QUICK_ACTION_COLUMN_PX },
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

{#snippet actionsCell(machine: Machine)}
	<ResourceRowActions
		label={`Actions for ${machine.name}`}
		quick={[
			{
				icon: Activity,
				label: 'Open health',
				onSelect: () => onOpenHealth(machine),
			},
		]}
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
	{sortConfig}
	{isLoading}
	{isFetching}
	{errorMessage}
	{onRetry}
	{empty}
	emptyMessage="No machines yet"
	onRowClick={onSelect ? selectRow : undefined}
	{onRowContextMenu}
	selection={selectable
		? { selectedRowIds, onChange: (ids) => (selectedRowIds = ids) }
		: undefined}
	{bulkActions}
	{onDeleteSelection}
/>
