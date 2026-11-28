<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { Machine } from '@snapflow/api-client';
import { renderComponent, renderSnippet } from '@tanstack/svelte-table';
import ResourceFilterField from '#lib/components/resource/filter/resource-filter-field.svelte';
import ResourceFilterPanel from '#lib/components/resource/filter/resource-filter-panel.svelte';
import Resource from '#lib/components/resource/resource.svelte';
import ResourceRefreshControl from '#lib/components/resource/resource-refresh-control.svelte';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
import ResourceRowContextMenu from '#lib/components/resource/resource-row-context-menu.svelte';
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import { resourceTextCell } from '#lib/components/resource/table/resource-cells.ts';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import {
	type ResourceColumnDefs,
	resourceColumnHelper,
} from '#lib/components/resource/table/resource-table-model.ts';
import TableFooter from '#lib/components/resource/table/table-footer.svelte';
import ChipCombobox from '#lib/components/ui/chip/chip-combobox.svelte';
import ChipModalConfirmTarget from '#lib/components/ui/chip-modal/chip-modal-confirm-target.svelte';
import AdminTableEmpty from '#lib/features/admin/components/shared/admin-table-empty.svelte';
import AdminToolbar from '#lib/features/admin/components/shared/admin-toolbar.svelte';
import {
	BADGE_COLUMN,
	TAG_COLUMN,
} from '#lib/features/admin/lib/admin-columns.ts';
import { adminTableError } from '#lib/features/admin/lib/admin-load-error.ts';
import {
	decommissionMachineCopy,
	deleteAdminMachineCopy,
} from '#lib/features/admin/lib/machines-list.ts';
import { AdminMachinesList } from '#lib/features/admin/state/machines-list.svelte.ts';
import { formatLocation } from '#lib/features/locations/lib/location-format.ts';
import {
	machineSchedulingLabel,
	machineServiceState,
} from '#lib/features/machines/lib/machine-format.ts';
import {
	machineCapacityColumn,
	machineCheckedColumn,
	machineNameColumn,
	machineStateColumn,
} from '#lib/features/machines/lib/machine-table-columns.ts';
import { countLabel } from '#lib/utils/format.ts';

const RESOURCE_LABEL = 'machines';
const SCHEDULING_STATE = {
	AVAILABLE: 'available',
	PAUSED: 'paused',
} as const;

const list = new AdminMachinesList();
const controls = $derived(list.controls);

const column = resourceColumnHelper<Machine>();
const columns: ResourceColumnDefs<Machine> = [
	machineNameColumn(
		(machine) => machine.appVersion ?? `API ${machine.apiVersion}`
	),
	machineStateColumn(),
	column.accessor((machine) => formatLocation(machine.location) ?? '', {
		id: 'location',
		header: 'Location',
		meta: { ...TAG_COLUMN, visibleFrom: 'xl' },
		cell: ({ getValue }) => resourceTextCell({ label: getValue() || null }),
	}),
	machineCapacityColumn('lg'),
	column.display({
		id: 'services',
		header: 'Services',
		meta: BADGE_COLUMN,
		cell: ({ row }) =>
			renderComponent(ResourceStateBadge, {
				state: machineServiceState(row.original),
			}),
	}),
	column.display({
		id: 'scheduling',
		header: 'Scheduling',
		meta: BADGE_COLUMN,
		cell: ({ row }) =>
			renderComponent(ResourceStateBadge, {
				state: row.original.unschedulable
					? SCHEDULING_STATE.PAUSED
					: SCHEDULING_STATE.AVAILABLE,
				label: machineSchedulingLabel(row.original),
			}),
	}),
	machineCheckedColumn(),
	column.display({
		id: 'actions',
		header: 'Actions',
		meta: { variant: 'actions' },
		cell: ({ row }) => renderSnippet(actionsCell, row.original),
	}),
];
</script>

{#snippet actionsCell(machine: Machine)}
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

{#snippet filterContent()}
	<ResourceFilterPanel>
		{#each controls.filterFields as field (field.id)}
			<ResourceFilterField label={field.label}>
				<ChipCombobox
					multiple
					fullWidth
					aria-label={field.label}
					placeholder={`All ${field.label.toLowerCase()}`}
					options={field.options}
					value={[...field.values]}
					onChange={(values) => field.onChange(values)}
				/>
			</ResourceFilterField>
		{/each}
	</ResourceFilterPanel>
{/snippet}

{#snippet emptyState()}
	<AdminTableEmpty
		message="No machines enrolled yet"
		resource={RESOURCE_LABEL}
		search={controls.search.value}
		filterCount={controls.filterTags.length}
		onClear={controls.clearSearchAndFilters}
	/>
{/snippet}

<Resource>
	<AdminToolbar
		title="Machines"
		{controls}
		searchPlaceholder="Search machines"
		filter={controls.filterFields.length > 0 ? filterContent : undefined}
		trailing={refreshControl}
	/>
	<ResourceRowContextMenu
		actionsFor={(rowId) =>
			rowId === null ? [] : list.machineRowActions(rowId)}
	>
		<ResourceDataTable
			caption="Machines"
			{columns}
			data={list.machines}
			getRowId={(machine) => machine.id}
			rowLabel={(machine) => machine.name}
			sort={controls.sort}
			sortConfig={controls.sortConfig}
			isLoading={list.machinesQuery.isLoading}
			isFetching={list.machinesQuery.isFetching}
			empty={emptyState}
			onRetry={() => void list.machinesQuery.refetch()}
			rowContextMenu
			errorMessage={adminTableError(list.machinesQuery.error, RESOURCE_LABEL)}
		/>
	</ResourceRowContextMenu>
	<TableFooter label={countLabel(list.machines.length, 'machine')} />
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
