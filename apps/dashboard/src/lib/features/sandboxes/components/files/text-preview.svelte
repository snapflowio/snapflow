<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const FILE_PREVIEW_LINE_HEIGHT = 24;
const FILE_PREVIEW_OVERSCAN = 20;
const estimateLineSize = () => FILE_PREVIEW_LINE_HEIGHT;
</script>

<script lang="ts">
import { VirtualList } from '#lib/components/ui/virtual-list.svelte.ts';

interface TextPreviewProps {
	content: string;
	virtualized: boolean;
	wrapLines: boolean;
}

let { content, virtualized, wrapLines }: TextPreviewProps = $props();

let viewport = $state<HTMLDivElement | null>(null);
const lines = $derived(content.split('\n'));
const list = new VirtualList(() => ({
	count: virtualized && !wrapLines ? lines.length : 0,
	estimateSize: estimateLineSize,
	overscan: FILE_PREVIEW_OVERSCAN,
	scrollElement: viewport,
}));
</script>

{#if !virtualized || wrapLines}
	<pre
		class={`scrollbar-none h-full overflow-auto p-4 font-mono text-(--text-body) text-caption leading-6 ${wrapLines ? 'whitespace-pre-wrap wrap-break-word' : 'whitespace-pre'}`}
	>{content}</pre>
{:else}
	<div
		bind:this={viewport}
		class="scrollbar-none h-full overflow-auto font-mono text-(--text-body) text-caption"
	>
		<div class="relative min-w-max" style:height={`${list.totalSize}px`}>
			{#each list.items as virtualLine (virtualLine.index)}
				<div
					class="absolute left-0 flex w-full whitespace-pre pr-4 leading-6"
					style:height={`${virtualLine.size}px`}
					style:transform={`translateY(${virtualLine.start}px)`}
				>
					<span
						class="sticky left-0 w-14 shrink-0 select-none border-border border-r bg-surface-1 pr-3 text-right text-(--text-muted)"
						>{virtualLine.index + 1}</span
					><span class="pl-4">{lines[virtualLine.index] ?? ''}</span>
				</div>
			{/each}
		</div>
	</div>
{/if}
