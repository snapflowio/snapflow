<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { HostMachine } from '@snapflow/api-client';
import type { Snippet } from 'svelte';
import type { ResourceBulkAction } from '#lib/components/resource/resource-bulk-action-bar.svelte';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import type { ResourceSortState } from '#lib/components/resource/table/resource-table-sort.ts';

interface HostListingsTableProps {
	machines: readonly HostMachine[];
	rowActions: (machine: HostMachine) => ResourceRowAction[];
	isLoading: boolean;
	errorMessage?: string;
	onRetry: () => void;
	onSelect: (machine: HostMachine) => void;
	onRowContextMenu?: (event: MouseEvent, machineId: string) => void;
	sort?: ResourceSortState;
	selectable?: boolean;
	selectedRowIds?: string[];
	bulkActions?: readonly ResourceBulkAction[];
	empty?: Snippet;
}
</script>

<script lang="ts">
import Cpu from '@lucide/svelte/icons/cpu';
import Gpu from '@lucide/svelte/icons/gpu';
import { renderSnippet } from '@tanstack/svelte-table';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import {
	resourceCell,
	resourceTextCell,
} from '#lib/components/resource/table/resource-cells.ts';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import { EMPTY_CELL_PLACEHOLDER } from '#lib/components/resource/table/resource-table.ts';
import {
	type ResourceColumnDefs,
	resourceColumnHelper,
} from '#lib/components/resource/table/resource-table-model.ts';
import { timeCell } from '#lib/components/resource/table/time-cell.ts';
import Badge from '#lib/components/ui/badge.svelte';
import {
	hostMachineSpecs,
	listingStateBadgeVariant,
} from '#lib/features/listings/lib/host-listing.ts';
import {
	listingPriceValue,
	listingStateRank,
	listingTierRank,
	listingUpdatedValue,
} from '#lib/features/listings/lib/host-listing-params.ts';
import {
	LISTING_STATE_LABELS,
	LISTING_VISIBILITY_LABELS,
	MACHINE_TIER_LABELS,
	tierBadgeVariant,
} from '#lib/features/listings/lib/listing-format.ts';
import { formatHourlyPrice } from '#lib/utils/usd.ts';

let {
	machines,
	rowActions,
	isLoading,
	errorMessage,
	onRetry,
	onSelect,
	onRowContextMenu,
	sort,
	selectable = false,
	selectedRowIds = $bindable([]),
	bulkActions = [],
	empty,
}: HostListingsTableProps = $props();

const column = resourceColumnHelper<HostMachine>();
const columns: ResourceColumnDefs<HostMachine> = $derived([
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
		header: 'Machine',
		cell: ({ row }) =>
			resourceCell(
				{
					icon: machineIcon,
					label: row.original.name,
					sublabel: hostMachineSpecs(row.original),
				},
				row.original
			),
	}),
	column.accessor(listingStateRank, {
		id: 'state',
		header: 'State',
		meta: { widthMultiplier: 0.7 },
		cell: ({ row }) => renderSnippet(stateCell, row.original),
	}),
	column.display({
		id: 'visibility',
		header: 'Visibility',
		meta: { widthMultiplier: 0.7 },
		cell: ({ row }) =>
			resourceTextCell({
				label: LISTING_VISIBILITY_LABELS[row.original.listing.visibility],
			}),
	}),
	column.accessor(listingTierRank, {
		id: 'tier',
		header: 'Tier',
		meta: { widthMultiplier: 0.8 },
		cell: ({ row }) => renderSnippet(tierCell, row.original),
	}),
	column.accessor(listingPriceValue, {
		id: 'price',
		header: 'Price',
		cell: ({ row }) => renderSnippet(priceCell, row.original),
	}),
	column.display({
		id: 'benchmark',
		header: 'Benchmark',
		meta: { widthMultiplier: 0.8 },
		cell: ({ row }) => renderSnippet(benchmarkCell, row.original),
	}),
	column.accessor(listingUpdatedValue, {
		id: 'updated',
		header: 'Last updated',
		cell: ({ row }) =>
			resourceTextCell(timeCell(row.original.listing.updatedAt)),
	}),
	column.display({
		id: 'actions',
		header: 'Actions',
		meta: { variant: 'actions' },
		cell: ({ row }) => renderSnippet(actionsCell, row.original),
	}),
]);
const machinesById = $derived(
	new Map(machines.map((machine) => [machine.machineId, machine]))
);

function selectRow(machineId: string): void {
	const machine = machinesById.get(machineId);
	if (machine) onSelect(machine);
}
</script>

{#snippet machineIcon(
	machine: HostMachine
)}
	{#if machine.gpuCount > 0}
		<Gpu class="size-3.5" />
	{:else}
		<Cpu class="size-3.5" />
	{/if}
{/snippet}

{#snippet stateCell(
	machine: HostMachine
)}
	<Badge
		dot
		size="sm"
		variant={listingStateBadgeVariant(machine.listing.state)}
	>
		{LISTING_STATE_LABELS[machine.listing.state]}
	</Badge>
{/snippet}

{#snippet tierCell(
	machine: HostMachine
)}
	<Badge size="sm" variant={tierBadgeVariant(machine.tier)}>
		{MACHINE_TIER_LABELS[machine.tier]}
	</Badge>
{/snippet}

{#snippet priceCell(
	machine: HostMachine
)}
	<span class="flex min-w-0 items-center gap-1.5">
		{#if machine.currentPriceCard}
			<span class="shrink-0 text-(--text-primary) tabular-nums">
				{formatHourlyPrice(machine.currentPriceCard.referencePriceMicroUsd)}
			</span>
			{#if machine.listing.belowFloorSince}
				<Badge dot size="sm" variant="primary">Below floor</Badge>
			{/if}
		{:else}
			<span class="truncate text-(--text-muted)">Not priced</span>
		{/if}
	</span>
{/snippet}

{#snippet benchmarkCell(
	machine: HostMachine
)}
	{#if machine.latestBenchmarkState}
		<ResourceStateBadge state={machine.latestBenchmarkState} />
	{:else}
		<span class="text-(--text-muted)">{EMPTY_CELL_PLACEHOLDER}</span>
	{/if}
{/snippet}

{#snippet actionsCell(
	machine: HostMachine
)}
	<ResourceRowActions
		label={`Actions for ${machine.name}`}
		actions={rowActions(machine)}
	/>
{/snippet}

<ResourceDataTable
	caption="My listings"
	{columns}
	data={machines}
	getRowId={(machine) => machine.machineId}
	rowLabel={(machine) => machine.name}
	{sort}
	{isLoading}
	{errorMessage}
	{onRetry}
	{empty}
	emptyMessage="No listings yet"
	onRowClick={selectRow}
	{onRowContextMenu}
	selection={selectable
		? { selectedRowIds, onChange: (ids) => (selectedRowIds = ids) }
		: undefined}
	{bulkActions}
/>
