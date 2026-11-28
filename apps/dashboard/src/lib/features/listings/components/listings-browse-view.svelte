<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Cpu from '@lucide/svelte/icons/cpu';
import EmptyState from '#lib/components/empty-state.svelte';
import ResourceFilterChips from '#lib/components/resource/filter/resource-filter-chips.svelte';
import Resource from '#lib/components/resource/resource.svelte';
import ResourceHeader from '#lib/components/resource/resource-header.svelte';
import ResourceNoResults from '#lib/components/resource/resource-no-results.svelte';
import type { ResourceSortConfig } from '#lib/components/resource/resource-options.ts';
import ResourceViewSwitch from '#lib/components/resource/resource-view-switch.svelte';
import TableFooter from '#lib/components/resource/table/table-footer.svelte';
import ListingFilterPanel from '#lib/features/listings/components/listing-filter-panel.svelte';
import ListingsTable from '#lib/features/listings/components/listings-table.svelte';
import {
	DEFAULT_MACHINE_SORT,
	isMachineBrowseSort,
	MACHINE_SORT_DIRECTIONS,
	MACHINE_SORT_OPTIONS,
} from '#lib/features/listings/lib/machine-filters.ts';
import {
	LISTING_SEGMENTS,
	MachineBrowser,
} from '#lib/features/listings/state/machine-browser.svelte.ts';
import { pluralize } from '#lib/utils/text.ts';

const browser = new MachineBrowser();
const query = $derived(browser.listingsQuery);
const sortActive = $derived(
	browser.sort === DEFAULT_MACHINE_SORT
		? null
		: { column: browser.sort, direction: MACHINE_SORT_DIRECTIONS[browser.sort] }
);
const sortConfig = $derived<ResourceSortConfig>({
	options: MACHINE_SORT_OPTIONS,
	active: sortActive,
	onSort: (column) => {
		if (isMachineBrowseSort(column)) browser.update({ sort: column });
	},
	onClear: browser.clearSort,
});
function clearNarrowing(): void {
	if (browser.query) browser.clearSearch();
	browser.clearFilters();
}
</script>

{#snippet filters()}
	<ListingFilterPanel {browser} />
{/snippet}

{#snippet segmentSwitch()}
	<ResourceViewSwitch
		options={LISTING_SEGMENTS}
		value={browser.segment}
		onChange={browser.changeSegment}
		aria-label="Category"
	/>
{/snippet}

{#snippet appliedFilters()}
	<div class="flex min-w-0 items-center gap-2 overflow-x-auto max-md:hidden">
		<ResourceFilterChips
			filterTags={browser.filterTags}
			onClearFilters={browser.clearFilters}
		/>
	</div>
{/snippet}

{#snippet emptyState()}
	{#if browser.narrowed}
		<ResourceNoResults
			search={browser.query}
			filterCount={browser.narrowingTags.length}
			filters={browser.narrowingTags}
			resource="machines"
			onClear={clearNarrowing}
		/>
	{:else}
		<EmptyState icon={Cpu} bordered={false} title="No machines listed yet" />
	{/if}
{/snippet}

<Resource>
	<ResourceHeader
		title="Marketplace"
		status={appliedFilters}
		search={{
			value: browser.search.value,
			onChange: (value) => (browser.search.value = value),
			placeholder: 'Search machines...',
		}}
		filter={{ active: browser.filterCount > 0, content: filters }}
		sort={sortConfig}
		trailing={segmentSwitch}
	/>
	<ListingsTable
		machines={browser.machines}
		{sortConfig}
		isLoading={query.isPending}
		isFetching={query.isFetching && !query.isFetchingNextPage}
		isError={query.isError && query.data === undefined}
		hasMore={query.hasNextPage}
		loadingMore={query.isFetchingNextPage}
		onLoadMore={browser.loadMore}
		onRetry={() => void query.refetch()}
		detailHref={browser.detailHref}
		empty={emptyState}
	/>
	{#if browser.machines.length > 0}
		<TableFooter label={pluralize(browser.machines.length, 'machine')} />
	{/if}
</Resource>
