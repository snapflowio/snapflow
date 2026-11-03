<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const PANEL_WIDTH = {
	DEFAULT: 360,
	MIN: 320,
	MAX: 480,
	MAX_VIEWPORT_RATIO: 0.6,
} as const;
const PANEL_WIDTH_STORAGE_KEY = 'snapflow-listing-filters-width';

function maximumWidth(): number {
	return Math.max(
		PANEL_WIDTH.MIN,
		Math.min(
			PANEL_WIDTH.MAX,
			window.innerWidth * PANEL_WIDTH.MAX_VIEWPORT_RATIO
		)
	);
}

function clampWidth(width: number): number {
	return Math.min(Math.max(width, PANEL_WIDTH.MIN), maximumWidth());
}
</script>

<script lang="ts">
import X from '@lucide/svelte/icons/x';
import { PersistedState } from 'runed';
import type { ResourceFilterSidebar } from '#lib/components/resource/filter/resource-filter-sidebar.svelte.ts';
import IconButton from '#lib/components/ui/icon-button.svelte';
import ResizeHandle from '#lib/components/ui/resize-handle/resize-handle.svelte';
import ScrollArea from '#lib/components/ui/scroll-area.svelte';
import type { MachineBrowser } from '#lib/features/listings/state/machine-browser.svelte.ts';
import { numberSerializer } from '#lib/utils/storage-serializers.ts';
import MachineListFilters from './machine-list-filters.svelte';

interface ListingFilterPanelProps {
	id: string;
	browser: MachineBrowser;
	sidebar: ResourceFilterSidebar;
}

let { id, browser, sidebar }: ListingFilterPanelProps = $props();

const titleId = $props.id();
const storedWidth = new PersistedState(
	PANEL_WIDTH_STORAGE_KEY,
	PANEL_WIDTH.DEFAULT,
	{ serializer: numberSerializer(PANEL_WIDTH.DEFAULT), syncTabs: false }
);
const width = $derived(clampWidth(storedWidth.current));

function closeOnEscape(event: KeyboardEvent) {
	if (sidebar.overlay && sidebar.open && event.key === 'Escape') {
		sidebar.close();
	}
}

function setWidth(next: number): void {
	storedWidth.current = clampWidth(next);
}
</script>

<svelte:window onkeydown={closeOnEscape} />

{#if sidebar.open}
	{#if sidebar.overlay}
		<button
			type="button"
			aria-label="Close filters"
			class="absolute inset-0 z-(--z-dropdown) bg-black/10"
			onclick={sidebar.close}
		></button>
	{/if}
	<aside
		{id}
		aria-labelledby={titleId}
		class={[
			'relative flex max-w-full shrink-0 flex-col border-border border-l bg-bg',
			sidebar.overlay &&
				'absolute inset-y-0 right-0 z-(--z-dropdown) shadow-md max-md:w-full!',
		]}
		style:width={`${width}px`}
	>
		{#if !sidebar.overlay}
			<ResizeHandle
				label="Resize filters"
				edge="left"
				class="z-1"
				value={width}
				min={PANEL_WIDTH.MIN}
				max={PANEL_WIDTH.MAX}
				widthAt={(clientX) => clampWidth(window.innerWidth - clientX)}
				onResize={setWidth}
			/>
		{/if}
		<div class="flex h-12 shrink-0 items-center justify-between gap-2 px-4">
			<h2 id={titleId} class="min-w-0 truncate text-(--text-primary) text-sm">
				Filters
			</h2>
			<div class="flex shrink-0 items-center gap-1">
				{#if browser.filterCount > 0}
					<button
						type="button"
						class="h-7 cursor-pointer rounded-md px-2 text-(--text-secondary) text-caption outline-none transition-colors hover-hover:bg-surface-active focus-visible:bg-surface-active"
						onclick={browser.clearFilters}
					>
						Clear all
					</button>
				{/if}
				<IconButton
					variant="ghost"
					label="Close filters"
					icon={X}
					onclick={sidebar.close}
				/>
			</div>
		</div>
		<ScrollArea aria-label="Filters" axis="vertical" class="flex-1">
			<div class="flex flex-col gap-5 pt-1 pb-6">
				<MachineListFilters {browser} />
			</div>
		</ScrollArea>
	</aside>
{/if}
