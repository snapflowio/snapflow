<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { Snippet } from 'svelte';
import type {
	ResourceFilterConfig,
	ResourceFilterTag,
	ResourceSearchConfig,
	ResourceSegment,
	ResourceSortConfig,
} from './resource-options.ts';
import type { ResourcePaginationConfig } from './resource-pagination.ts';

interface ResourceOptionsBarProps {
	segments?: readonly ResourceSegment[];
	segment?: string;
	onSegmentChange?: (value: string) => void;
	pagination?: ResourcePaginationConfig;
	search?: ResourceSearchConfig | Snippet;
	filterTags?: readonly ResourceFilterTag[];
	onClearFilters?: () => void;
	filter?: ResourceFilterConfig;
	sort?: ResourceSortConfig;
	extras?: Snippet;
	extrasAlign?: 'start' | 'end';
}

type OptionsMenu = 'filter' | 'sort';
</script>

<script lang="ts">
import ResourceFilterChips from '#lib/components/resource/filter/resource-filter-chips.svelte';
import ResourceFilterControl from '#lib/components/resource/filter/resource-filter-control.svelte';
import ChipSwitch from '#lib/components/ui/chip/chip-switch.svelte';
import ResourcePaginationCompact from './resource-pagination-compact.svelte';
import ResourceSearchField from './resource-search-field.svelte';
import ResourceSortMenu from './resource-sort-menu.svelte';

let {
	segments = [],
	segment,
	onSegmentChange,
	pagination,
	search,
	filterTags = [],
	onClearFilters,
	filter,
	sort,
	extras,
	extrasAlign = 'start',
}: ResourceOptionsBarProps = $props();

let openMenu = $state<OptionsMenu | null>(null);
const hasFilterTags = $derived(filterTags.length > 0);
const hasMenuControls = $derived(Boolean(filter || sort || hasFilterTags));

function menuOpenChange(menu: OptionsMenu) {
	return (open: boolean) => {
		if (open) {
			openMenu = menu;
		} else if (openMenu === menu) {
			openMenu = null;
		}
	};
}
</script>

{#if search || extras || hasMenuControls || segments.length > 0 || pagination}
	<div class={['shrink-0 border-border border-b px-4 py-3']}>
		<div
			class="flex min-h-8 flex-wrap items-center gap-x-4 gap-y-2 md:flex-nowrap"
		>
			{#if segments.length > 0}
				<ChipSwitch
					options={segments}
					value={segment ?? segments[0]?.value ?? ''}
					onChange={onSegmentChange}
					aria-label="View"
					size="compact"
				/>
			{/if}
			{#if typeof search === 'function'}
				{@render search()}
			{:else if search}
				<ResourceSearchField
					value={search.value}
					onValueChange={search.onChange}
					placeholder={search.placeholder}
					aria-label={search.ariaLabel}
				/>
			{/if}
			<div
				class={[
					'flex min-w-0 max-w-full flex-wrap items-center gap-2',
					search ? 'w-full sm:w-auto sm:shrink' : 'flex-1',
					(search || extrasAlign === 'end') && 'ml-auto',
					!search && extrasAlign === 'end' && 'justify-end',
				]}
			>
				{@render extras?.()}
				{#if hasMenuControls}
					<div class="flex max-w-full flex-wrap items-center gap-2">
						<ResourceFilterChips {filterTags} {onClearFilters} />
						{#if filter}
							<ResourceFilterControl
								{filter}
								open={openMenu === 'filter'}
								onOpenChange={menuOpenChange('filter')}
							/>
						{/if}
						{#if sort}
							<ResourceSortMenu
								{sort}
								open={openMenu === 'sort'}
								onOpenChange={menuOpenChange('sort')}
							/>
						{/if}
					</div>
				{/if}
				{#if pagination}
					<ResourcePaginationCompact {pagination} />
				{/if}
			</div>
		</div>
	</div>
{/if}
