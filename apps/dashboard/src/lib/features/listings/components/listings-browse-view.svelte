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
import {
	formatListingSpecs,
	MACHINE_UNAVAILABLE_REASON_LABELS,
} from '#lib/features/listings/lib/listing-format.ts';

const FILTER_PANEL_ID = 'listing-filters';
const FILTER_PANEL_STORAGE_KEY = 'snapflow-listings-filters-open';

function unavailableLabel(machine: MachineListing): string {
	return machine.unavailableReason
		? MACHINE_UNAVAILABLE_REASON_LABELS[machine.unavailableReason]
		: 'Unavailable';
}
</script>

<script lang="ts">
import EmptyState from '#lib/components/empty-state.svelte';
import FeedbackState from '#lib/components/feedback-state.svelte';
import { ResourceFilterSidebar } from '#lib/components/resource/filter/resource-filter-sidebar.svelte.ts';
import LoadMoreSentinel from '#lib/components/resource/load-more-sentinel.svelte';
import Resource from '#lib/components/resource/resource.svelte';
import ResourceOptionsBar from '#lib/components/resource/resource-options-bar.svelte';
import SettingsResourceRow from '#lib/components/settings/settings-resource-row.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ListingFilterPanel from '#lib/features/listings/components/listing-filter-panel.svelte';
import ListingHeader from '#lib/features/listings/components/listing-header.svelte';
import ListingSection from '#lib/features/listings/components/listing-section.svelte';
import ListingTile from '#lib/features/listings/components/listing-tile.svelte';
import {
	MACHINE_CATEGORY_LABELS,
	MACHINE_TIER_LABELS,
	tierBadgeVariant,
} from '#lib/features/listings/lib/listing-format.ts';
import {
	DEFAULT_MACHINE_SORT,
	isMachineBrowseSort,
	MACHINE_SORT_DIRECTIONS,
	MACHINE_SORT_OPTIONS,
} from '#lib/features/listings/lib/machine-filters.ts';
import { MachineBrowser } from '#lib/features/listings/state/machine-browser.svelte.ts';
import { locationLabel } from '#lib/features/locations/lib/location-format.ts';
import { formatHourlyPrice } from '#lib/utils/usd.ts';

const browser = new MachineBrowser();
const filterPanel = new ResourceFilterSidebar(FILTER_PANEL_STORAGE_KEY);
const query = $derived(browser.listingsQuery);
const settled = $derived(!query.isPending && !query.isError);
const narrowed = $derived(Boolean(browser.query) || browser.filterCount > 0);
const sortActive = $derived(
	browser.sort === DEFAULT_MACHINE_SORT
		? null
		: { column: browser.sort, direction: MACHINE_SORT_DIRECTIONS[browser.sort] }
);
const clearLabel = $derived(
	browser.query && browser.filterCount > 0
		? 'Clear search and filters'
		: browser.query
			? 'Clear search'
			: 'Clear filters'
);

function clearNarrowing(): void {
	if (browser.query) browser.clearSearch();
	if (browser.filterCount > 0) browser.clearFilters();
}

function describe(machine: MachineListing): string {
	return `${formatListingSpecs(machine)} · ${locationLabel(machine.location)} · ${formatHourlyPrice(machine.hourlyPriceMicroUsd)}`;
}
</script>

<Resource>
	<ListingHeader />
	<ResourceOptionsBar
		search={{
			value: browser.search.value,
			onChange: (value) => (browser.search.value = value),
			placeholder: 'Search listings...',
			ariaLabel: 'Search listings',
		}}
		filterTags={browser.filterTags}
		onClearFilters={browser.clearFilters}
		filter={{
			sidebarId: FILTER_PANEL_ID,
			open: filterPanel.open,
			onToggle: filterPanel.toggle,
		}}
		sort={{
			options: MACHINE_SORT_OPTIONS,
			active: sortActive,
			onSort: (column) => {
				if (isMachineBrowseSort(column)) browser.update({ sort: column });
			},
			onClear: browser.clearSort,
		}}
	/>
	<div class="relative flex min-h-0 flex-1 overflow-hidden">
		<div
			class="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-4 pt-5 pb-6 md:px-6"
		>
			<div class="flex min-h-full flex-col gap-7">
				{#if query.isError && query.data === undefined}
					<FeedbackState
						variant="inline"
						tone="error"
						retrying={query.isFetching}
						onRetry={() => void query.refetch()}
					>
						Failed to load listings
					</FeedbackState>
				{:else if query.isPending}
					<FeedbackState variant="inline"> Loading listings... </FeedbackState>
				{:else if settled &&
					browser.sections.length === 0 &&
					!query.hasNextPage}
					{#if narrowed}
						<EmptyState
							illustration={false}
							title={browser.query
								? `No results for “${browser.query}”`
								: 'No results'}
							description={browser.query
								? 'Searched the listings loaded for this shape.'
								: 'Filters apply to every machine on the marketplace.'}
						>
							{#snippet actions()}
								<Chip variant="border" onclick={clearNarrowing}>
									{clearLabel}
								</Chip>
							{/snippet}
						</EmptyState>
					{:else}
						<EmptyState
							title="No listings yet"
							description="Machines appear here once hosts list them."
						/>
					{/if}
				{:else}
					<div class="flex flex-col gap-7">
						{#each browser.sections as section (section.category)}
							<ListingSection label={MACHINE_CATEGORY_LABELS[section.category]}>
								{#each section.machines as machine (machine.machineId)}
									{#snippet tile()}
										<ListingTile gpuCount={machine.gpuCount} />
									{/snippet}
									{#snippet badge()}
										{#if machine.available}
											<Badge size="sm" variant={tierBadgeVariant(machine.tier)}>
												{MACHINE_TIER_LABELS[machine.tier]}
											</Badge>
										{:else}
											<Badge size="sm" variant="gray-secondary">
												{unavailableLabel(machine)}
											</Badge>
										{/if}
									{/snippet}
									<SettingsResourceRow
										title={machine.name}
										description={describe(machine)}
										{tile}
										{badge}
										href={browser.detailHref(machine)}
										clickLabel={`Open ${machine.name}`}
									/>
								{/each}
							</ListingSection>
						{/each}
						{#if query.hasNextPage}
							<LoadMoreSentinel
								loading={query.isFetchingNextPage}
								onLoadMore={browser.loadMore}
							/>
						{/if}
					</div>
				{/if}
			</div>
		</div>
		<ListingFilterPanel id={FILTER_PANEL_ID} {browser} sidebar={filterPanel} />
	</div>
</Resource>
