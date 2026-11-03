<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const PERCENT = 100;
const OVERVIEW_DEFAULT_PIXELS = 320;
const OVERVIEW_MINIMUM_PIXELS = 250;
const OVERVIEW_MAXIMUM_PIXELS = 550;
const KEYBOARD_RESIZE_PERCENT = 5;
const OVERVIEW_PANE_ORDER = 1;
const CONTENT_PANE_ORDER = 2;
</script>

<script lang="ts">
import { Pane, PaneGroup, PaneResizer } from 'paneforge';
import { ElementSize } from 'runed';
import type { Snippet } from 'svelte';
import ResourcePanelHeader from '#lib/components/resource/resource-panel-header.svelte';

interface ResourceDetailPanesProps {
	aside: Snippet;
	asideTitle: string;
	children: Snippet;
}

let { aside, asideTitle, children }: ResourceDetailPanesProps = $props();

let groupElement = $state<HTMLElement | null>(null);
let resizerElement = $state<HTMLElement | null>(null);
const groupSize = new ElementSize(() => groupElement);
const resizerSize = new ElementSize(() => resizerElement);
const paneWidth = $derived(groupSize.width - resizerSize.width);
let overviewPane = $state<ReturnType<typeof Pane> | null>(null);
let overviewPercent: number | null = null;

const toPercent = (pixels: number) => (pixels / paneWidth) * PERCENT;
const overview = $derived(
	paneWidth > 0
		? {
				defaultSize: overviewPercent ?? toPercent(OVERVIEW_DEFAULT_PIXELS),
				maxSize: toPercent(OVERVIEW_MAXIMUM_PIXELS),
				minSize: toPercent(OVERVIEW_MINIMUM_PIXELS),
			}
		: null
);

const resetOverview = () =>
	overviewPane?.resize(toPercent(OVERVIEW_DEFAULT_PIXELS));
</script>

<PaneGroup
	bind:ref={groupElement}
	id="resource-detail-layout"
	direction="horizontal"
	keyboardResizeBy={KEYBOARD_RESIZE_PERCENT}
	class="flex min-h-0 flex-1 overflow-hidden"
>
	{#if overview}
		<Pane
			bind:this={overviewPane}
			id="resource-overview"
			order={OVERVIEW_PANE_ORDER}
			defaultSize={overview.defaultSize}
			minSize={overview.minSize}
			maxSize={overview.maxSize}
			onResize={(size) => {
				overviewPercent = size;
			}}
			class="flex min-h-0 flex-col overflow-hidden"
		>
			<ResourcePanelHeader title={asideTitle} />
			{@render aside()}
		</Pane>
	{/if}
	<PaneResizer
		bind:ref={resizerElement}
		ondblclick={resetOverview}
		class="relative w-px shrink-0 cursor-ew-resize bg-border outline-none focus-visible:bg-brand-secondary"
	>
		<span
			aria-hidden="true"
			class="absolute inset-y-0 left-1/2 z-10 w-2 -translate-x-1/2 pointer-coarse:w-5"
		></span>
	</PaneResizer>
	<Pane
		id="resource-content"
		order={CONTENT_PANE_ORDER}
		class="flex min-w-0 flex-1 flex-col overflow-hidden"
	>
		{@render children()}
	</Pane>
</PaneGroup>
