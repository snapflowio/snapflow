<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import * as z from 'zod';
import {
	adminSearchField,
	adminSortFields,
} from '#lib/features/admin/lib/admin-list.ts';
import { formatHourlyPrice } from '#lib/utils/usd.ts';

const NOT_SET = 'Not set';
const SORT_OPTIONS = [
	{ id: 'priceClass', label: 'Price class' },
	{ id: 'effective', label: 'Effective median' },
	{ id: 'computed', label: 'Computed' },
] as const;

const pricesSearchSchema = z.object({
	q: adminSearchField,
	...adminSortFields(['priceClass', 'effective', 'computed']),
});

function hourly(value: string | null): string {
	return value === null ? NOT_SET : formatHourlyPrice(value);
}
</script>

<script lang="ts">
import Pencil from '@lucide/svelte/icons/pencil';
import type { MarketReferencePrice } from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import { renderSnippet } from '@tanstack/svelte-table';
import {
	referencePricesQueryOptions,
	updateReferencePriceMutationOptions,
} from '#lib/api/admin/listings.ts';
import EmptyState from '#lib/components/empty-state.svelte';
import Credit from '#lib/components/icons/credit.svelte';
import ResourceOptionsBar from '#lib/components/resource/resource-options-bar.svelte';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
import { renderResourceLabel } from '#lib/components/resource/table/resource-cell.ts';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import { resourceColumnHelper } from '#lib/components/resource/table/resource-table-model.ts';
import { timeCell } from '#lib/components/resource/table/time-cell.ts';
import AdminNoResults from '#lib/features/admin/components/admin-no-results.svelte';
import AdminTableContextMenu from '#lib/features/admin/components/admin-table-context-menu.svelte';
import { adminTableErrorProps } from '#lib/features/admin/components/admin-table-error.svelte';
import {
	adminSortConfig,
	adminSortState,
	matchesSearch,
} from '#lib/features/admin/lib/admin-list.ts';
import { PRICE_FLOOR_SOURCE_LABELS } from '#lib/features/listings/lib/listing-format.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
import ReferencePriceModal from './reference-price-modal.svelte';

const params = new SearchParams(pricesSearchSchema);
const search = params.text('q');
const pricesQuery = createQuery(() => referencePricesQueryOptions());
const updateReferencePrice = createMutation(() =>
	updateReferencePriceMutationOptions()
);
let editing = $state.raw<MarketReferencePrice | null>(null);

const allPrices = $derived(pricesQuery.data ?? []);
const pricesByClass = $derived(
	new Map(allPrices.map((price) => [price.priceClass, price]))
);
const prices = $derived(
	allPrices.filter((price) => matchesSearch(search.value, [price.priceClass]))
);
const sort = $derived(adminSortState(params.current.sort, params.current.dir));

const column = resourceColumnHelper<MarketReferencePrice>();
const columns = [
	column.accessor('priceClass', {
		id: 'priceClass',
		header: 'Price class',
		cell: ({ getValue }) =>
			renderResourceLabel({ icon: creditIcon, label: getValue() }),
	}),
	column.accessor((price) => hourly(price.bootstrapMedianMicroUsd), {
		id: 'bootstrap',
		header: 'Bootstrap median',
		cell: ({ getValue }) => renderResourceLabel({ label: getValue() }),
	}),
	column.accessor((price) => hourly(price.marketMedianMicroUsd), {
		id: 'market',
		header: 'Market median',
		cell: ({ getValue, row }) =>
			renderResourceLabel({
				label: getValue(),
				sublabel: `${row.original.sampleCount} hosts`,
			}),
	}),
	column.accessor((price) => Number(price.effectiveMedianMicroUsd ?? 0), {
		id: 'effective',
		header: 'Effective median',
		cell: ({ row }) =>
			renderResourceLabel({
				label: hourly(row.original.effectiveMedianMicroUsd),
				sublabel: row.original.source
					? PRICE_FLOOR_SOURCE_LABELS[row.original.source]
					: undefined,
			}),
	}),
	column.accessor((price) => hourly(price.floorMicroUsd), {
		id: 'floor',
		header: 'Floor',
		cell: ({ getValue }) => renderResourceLabel({ label: getValue() }),
	}),
	column.accessor((price) => price.computedAt ?? '', {
		id: 'computed',
		header: 'Computed',
		cell: ({ row }) => renderResourceLabel(timeCell(row.original.computedAt)),
	}),
	column.display({
		id: 'actions',
		header: 'Actions',
		meta: { variant: 'actions' },
		cell: ({ row }) => renderSnippet(actionsCell, row.original),
	}),
];

function priceActions(price: MarketReferencePrice): ResourceRowAction[] {
	return [
		{
			icon: Pencil,
			label: 'Set bootstrap median',
			onSelect: () => {
				editing = price;
			},
		},
	];
}

function priceRowActions(priceClass: string): ResourceRowAction[] {
	const price = pricesByClass.get(priceClass);
	return price ? priceActions(price) : [];
}

function openPrice(priceClass: string) {
	editing = pricesByClass.get(priceClass) ?? null;
}
</script>

{#snippet creditIcon()}
	<Credit />
{/snippet}

{#snippet actionsCell(
	price: MarketReferencePrice
)}
	<ResourceRowActions
		label={`${price.priceClass} actions`}
		actions={priceActions(price)}
	/>
{/snippet}

{#snippet emptyState()}
	{#if search.value}
		<AdminNoResults
			search={search.value}
			onClear={() => {
				search.value = '';
				void params.update({ q: undefined });
			}}
		/>
	{:else}
		<EmptyState
			title="Reference prices"
			description="Price classes appear here once hosts benchmark their machines."
		/>
	{/if}
{/snippet}

<ResourceOptionsBar
	search={{
		value: search.value,
		onChange: (value) => {
			search.value = value;
		},
		placeholder: 'Search price classes...',
		ariaLabel: 'Search price classes',
	}}
	sort={adminSortConfig(SORT_OPTIONS, sort, (sortColumn, dir) =>
		params.update({ sort: sortColumn, dir })
	)}
/>
<AdminTableContextMenu rowActions={priceRowActions}>
	<ResourceDataTable
		caption="Market reference prices"
		{columns}
		data={prices}
		getRowId={(price) => price.priceClass}
		rowLabel={(price) => price.priceClass}
		{sort}
		selectedRowId={editing?.priceClass ?? null}
		isLoading={pricesQuery.isLoading}
		empty={emptyState}
		onRetry={() => void pricesQuery.refetch()}
		onRowClick={openPrice}
		onRowContextMenu={() => {}}
		{...adminTableErrorProps(
			pricesQuery.error,
			'Failed to load reference prices'
		)}
	/>
</AdminTableContextMenu>
<ReferencePriceModal
	price={editing}
	pending={updateReferencePrice.isPending}
	onClose={() => {
		editing = null;
	}}
	onSave={(priceClass, bootstrapMedianMicroUsd) =>
		updateReferencePrice.mutate(
			{ bootstrapMedianMicroUsd, priceClass },
			{
				onSuccess: () => {
					editing = null;
				},
			}
		)}
/>
