<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { MachineListing } from '@snapflow/api-client';
import type { Snippet } from 'svelte';
import type { ResourceSortConfig } from '#lib/components/resource/resource-options.ts';

interface ListingsTableProps {
	machines: readonly MachineListing[];
	sortConfig?: ResourceSortConfig;
	isLoading: boolean;
	isFetching: boolean;
	isError: boolean;
	hasMore: boolean;
	loadingMore: boolean;
	onLoadMore: () => void;
	onRetry: () => void;
	detailHref: (machine: MachineListing) => string;
	empty: Snippet;
}

const COLUMN_GROW = { machine: 2, gpu: 1 } as const;
const COLUMN_WIDTH = {
	vcpu: 72,
	ram: 88,
	location: 120,
	reliability: 104,
	price: 104,
} as const;
const FREE_LABEL = 'Free';
</script>

<script lang="ts">
import ChevronRight from '@lucide/svelte/icons/chevron-right';
import { renderSnippet } from '@tanstack/svelte-table';
import {
	resourceCell,
	resourceTextCell,
} from '#lib/components/resource/table/resource-cells.ts';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import {
	type ResourceColumnDefs,
	resourceColumnHelper,
} from '#lib/components/resource/table/resource-table-model.ts';
import Badge from '#lib/components/ui/badge.svelte';
import { chipContentGap } from '#lib/components/ui/chip/chip-chrome.ts';
import Money from '#lib/components/ui/money.svelte';
import OverflowText from '#lib/components/ui/overflow/overflow-text.svelte';
import {
	formatGpu,
	MACHINE_TIER_LABELS,
	MACHINE_UNAVAILABLE_REASON_LABELS,
	tierBadgeVariant,
} from '#lib/features/listings/lib/listing-format.ts';
import { formatLocation } from '#lib/features/locations/lib/location-format.ts';
import { formatBasisPointsPercent } from '#lib/utils/format.ts';
import { goto, preloadData } from '$app/navigation';

let {
	machines,
	sortConfig,
	isLoading,
	isFetching,
	isError,
	hasMore,
	loadingMore,
	onLoadMore,
	onRetry,
	detailHref,
	empty,
}: ListingsTableProps = $props();

const machineById = $derived(
	new Map(machines.map((machine) => [machine.machineId, machine]))
);

const column = resourceColumnHelper<MachineListing>();
const columns: ResourceColumnDefs<MachineListing> = [
	column.accessor('name', {
		header: 'Machine',
		meta: { grow: COLUMN_GROW.machine },
		cell: ({ row }) => resourceCell({ content: nameCell }, row.original),
	}),
	column.display({
		id: 'gpu',
		header: 'GPU',
		meta: { grow: COLUMN_GROW.gpu },
		cell: ({ row }) => resourceTextCell({ label: formatGpu(row.original) }),
	}),
	column.accessor('vcpu', {
		header: 'vCPU',
		meta: { align: 'end', width: COLUMN_WIDTH.vcpu },
		cell: ({ getValue }) => resourceTextCell({ label: String(getValue()) }),
	}),
	column.accessor('memoryGiB', {
		id: 'ram',
		header: 'RAM',
		meta: { align: 'end', width: COLUMN_WIDTH.ram },
		cell: ({ getValue }) => resourceTextCell({ label: `${getValue()} GiB` }),
	}),
	column.accessor('location', {
		header: 'Location',
		meta: { width: COLUMN_WIDTH.location, visibleFrom: 'xl' },
		cell: ({ getValue }) =>
			resourceTextCell({ label: formatLocation(getValue()) }),
	}),
	column.accessor('reliabilityBasisPoints', {
		id: 'reliability',
		header: 'Reliability',
		meta: { align: 'end', width: COLUMN_WIDTH.reliability, visibleFrom: 'lg' },
		cell: ({ getValue }) =>
			resourceTextCell({ label: formatBasisPointsPercent(getValue()) }),
	}),
	column.accessor('hourlyPriceMicroUsd', {
		id: 'price',
		header: 'Price',
		meta: { align: 'end', width: COLUMN_WIDTH.price, compact: true },
		cell: ({ row }) => renderSnippet(priceCell, row.original),
	}),
	column.display({
		id: 'actions',
		header: 'Open',
		meta: { variant: 'actions' },
		cell: () => renderSnippet(arrowCell),
	}),
];

function open(machineId: string): void {
	const machine = machineById.get(machineId);
	if (machine) void goto(detailHref(machine));
}

function preload(machineId: string): void {
	const machine = machineById.get(machineId);
	if (machine) void preloadData(detailHref(machine));
}
</script>

{#snippet nameCell(machine: MachineListing)}
	<a
		href={detailHref(machine)}
		class={[
			'flex min-w-0 items-center rounded-sm outline-none hover-hover:underline focus-visible:underline',
			chipContentGap,
		]}
	>
		<OverflowText text={machine.name} />
		{#if machine.available}
			<Badge size="pill" variant={tierBadgeVariant(machine.tier)}>
				{MACHINE_TIER_LABELS[machine.tier]}
			</Badge>
		{:else}
			<Badge size="pill" variant="neutral">
				{machine.unavailableReason
					? MACHINE_UNAVAILABLE_REASON_LABELS[machine.unavailableReason]
					: 'Unavailable'}
			</Badge>
		{/if}
	</a>
{/snippet}

{#snippet priceCell(machine: MachineListing)}
	{#if machine.priceCardId === null}
		<span class="text-(--text-muted)">{FREE_LABEL}</span>
	{:else}
		<Money microUsd={machine.hourlyPriceMicroUsd} unit="/h" />
	{/if}
{/snippet}

{#snippet arrowCell()}
	<ChevronRight
		aria-hidden="true"
		class="size-4 text-(--text-subtle) transition-colors duration-(--motion-quick) group-hover/row:text-(--text-primary)"
	/>
{/snippet}

<ResourceDataTable
	caption="Marketplace machines"
	{columns}
	data={machines}
	getRowId={(machine) => machine.machineId}
	rowLabel={(machine) => machine.name}
	rowDimmed={(machine) => !machine.available}
	{sortConfig}
	sortedByServer
	{isLoading}
	{isFetching}
	errorMessage={isError ? "Couldn't load listings" : undefined}
	{onRetry}
	{empty}
	{hasMore}
	{loadingMore}
	{onLoadMore}
	onRowClick={open}
	onRowHover={preload}
/>
