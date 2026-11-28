<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ScrollArea from '#lib/components/ui/scroll-area.svelte';
import type { MachineBrowser } from '#lib/features/listings/state/machine-browser.svelte.ts';
import MachineListFilters from './machine-list-filters.svelte';

interface ListingFilterPanelProps {
	browser: MachineBrowser;
}

let { browser }: ListingFilterPanelProps = $props();

const titleId = $props.id();
</script>

<section
	aria-labelledby={titleId}
	class="flex max-h-[min(70dvh,40rem)] w-full flex-col text-[13px] md:w-80"
>
	<div
		class="flex h-11 shrink-0 items-center justify-between gap-2 border-border border-b px-4"
	>
		<h2 id={titleId} class="min-w-0 truncate text-(--text-primary) text-sm">
			Filters
		</h2>
		{#if browser.filterCount > 0}
			<button
				type="button"
				class="h-7 cursor-pointer rounded-md px-2 text-(--text-muted) text-xs outline-none transition-colors hover-hover:bg-surface-5 hover-hover:text-(--text-primary) focus-visible:focus-ring"
				onclick={browser.clearFilters}
			>
				Clear all
			</button>
		{/if}
	</div>
	<ScrollArea aria-label="Filters" axis="vertical" class="min-h-0 flex-1">
		<div class="flex flex-col gap-6 pt-4 pb-5">
			<MachineListFilters {browser} />
		</div>
	</ScrollArea>
</section>
