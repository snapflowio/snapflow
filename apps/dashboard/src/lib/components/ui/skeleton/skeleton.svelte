<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { ClassValue } from 'svelte/elements';

export interface SkeletonProps {
	class?: ClassValue;
	groupClass?: ClassValue;
	repeat?: number;
	fade?: boolean;
	delayMs?: number;
	label?: string;
	decorative?: boolean;
}

const ITEM_CLASS = 'rounded-lg transition-colors duration-(--motion-quick)';
export const SKELETON_BLOCK_ROWS = 6;
export const SKELETON_SECTION_ROWS = 3;
</script>

<script lang="ts">
import { cn } from '#lib/utils/utils.ts';
import {
	DelayedReveal,
	SKELETON_DELAY_MS,
	SKELETON_PULSE_DELAY_MS,
} from './delayed-reveal.svelte.ts';

let {
	class: className,
	groupClass,
	repeat = 1,
	fade = false,
	delayMs = SKELETON_DELAY_MS,
	label = 'Loading',
	decorative = false,
}: SkeletonProps = $props();

const reveal = new DelayedReveal(() => delayMs);
const pulse = new DelayedReveal(() => delayMs + SKELETON_PULSE_DELAY_MS);
const items = $derived(
	Array.from({ length: Math.max(1, repeat) }, (_, i) => i)
);
const itemClass = $derived(
	cn(
		ITEM_CLASS,
		reveal.visible ? 'bg-surface-3' : 'bg-transparent',
		pulse.visible && 'animate-pulse motion-reduce:animate-none',
		className
	)
);

function itemOpacity(index: number): number | undefined {
	return fade ? 1 - index / items.length : undefined;
}
</script>

{#if repeat > 1}
	<div
		role={decorative ? undefined : 'status'}
		aria-hidden={decorative ? 'true' : undefined}
		aria-busy={decorative ? undefined : 'true'}
		class={cn('flex flex-col gap-2', groupClass)}
	>
		{#if !decorative}
			<span class="sr-only">{label}</span>
		{/if}
		{#each items as index (index)}
			<div
				aria-hidden="true"
				class={itemClass}
				style:opacity={itemOpacity(index)}
			></div>
		{/each}
	</div>
{:else}
	<div
		role={decorative ? undefined : 'status'}
		aria-hidden={decorative ? 'true' : undefined}
		aria-busy={decorative ? undefined : 'true'}
		class={itemClass}
	>
		{#if !decorative}
			<span class="sr-only">{label}</span>
		{/if}
	</div>
{/if}
