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
import type { AdminListControls } from '#lib/features/admin/state/admin-list-controls.svelte.ts';
import type { AdminViewSwitch } from '#lib/features/admin/state/admin-view-param.svelte.ts';

interface AdminToolbarProps {
	title: string;
	controls: AdminListControls;
	searchPlaceholder: string;
	viewSwitch?: AdminViewSwitch;
	filter?: Snippet;
	sortable?: boolean;
	trailing?: Snippet;
}
</script>

<script lang="ts">
import ResourceFilterChips from '#lib/components/resource/filter/resource-filter-chips.svelte';
import ResourceFilterPanel from '#lib/components/resource/filter/resource-filter-panel.svelte';
import ResourceHeader from '#lib/components/resource/resource-header.svelte';
import ChipSwitch from '#lib/components/ui/chip/chip-switch.svelte';

let {
	title,
	controls,
	searchPlaceholder,
	viewSwitch,
	filter,
	sortable = true,
	trailing,
}: AdminToolbarProps = $props();

const hasFilter = $derived(
	filter !== undefined || controls.filterFields.length > 0
);
</script>

{#snippet quickFilters()}
	<ResourceFilterPanel quickFields={controls.filterFields} />
{/snippet}

{#snippet trailingControls()}
	{#if viewSwitch}
		<ChipSwitch
			size="compact"
			aria-label={`${title} views`}
			options={viewSwitch.segments}
			value={viewSwitch.segment}
			onChange={viewSwitch.onSegmentChange}
		/>
	{/if}
	{@render trailing?.()}
{/snippet}

{#snippet leading()}
	<div class="flex min-w-0 items-center gap-2 overflow-x-auto scrollbar-none">
		<ResourceFilterChips
			filterTags={controls.filterTags}
			onClearFilters={controls.clearFilters}
		/>
	</div>
{/snippet}

<ResourceHeader
	{title}
	status={leading}
	search={{
		value: controls.search.value,
		onChange: (value) => {
			controls.search.value = value;
		},
		placeholder: searchPlaceholder,
	}}
	filter={hasFilter
		? { content: filter ?? quickFilters, active: controls.filterCount > 0 }
		: undefined}
	sort={sortable ? controls.sortConfig : undefined}
	trailing={trailingControls}
/>
