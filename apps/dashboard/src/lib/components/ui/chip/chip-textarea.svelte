<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
export const TEXT_COUNTER_THRESHOLD = 0.8;
</script>

<script lang="ts">
import type { HTMLTextareaAttributes } from 'svelte/elements';
import { cn } from '#lib/utils/utils.ts';
import { chipFieldSurfaceClass, chipFieldTextClass } from './chip-chrome.ts';
import { CHIP_FIELD_FOCUS_CLASS } from './chip-input.svelte';

interface ChipTextareaProps extends HTMLTextareaAttributes {
	error?: boolean;
	resizable?: boolean;
	ref?: HTMLTextAreaElement | null;
}

let {
	class: className,
	error: invalid = false,
	resizable = false,
	maxlength,
	value = $bindable(),
	ref = $bindable(null),
	...rest
}: ChipTextareaProps = $props();

const length = $derived(typeof value === 'string' ? value.length : 0);
const showsCounter = $derived(
	typeof maxlength === 'number' &&
		maxlength > 0 &&
		length >= maxlength * TEXT_COUNTER_THRESHOLD
);
</script>

<div class="relative w-full">
	<textarea
		bind:this={ref}
		bind:value
		{maxlength}
		class={cn(
			chipFieldSurfaceClass,
			chipFieldTextClass,
			'block min-h-30 w-full overflow-auto rounded-xl px-3 py-2.5 text-sm md:text-sm focus-visible:border-(--accent-fill) focus-visible:ring-[3px] focus-visible:ring-(--accent-fill)/40 disabled:cursor-not-allowed disabled:opacity-50',
			!rest.disabled && CHIP_FIELD_FOCUS_CLASS,
			resizable ? 'resize-y' : 'resize-none',
			invalid && 'border-(--text-error)/60',
			showsCounter && 'pb-7',
			className
		)}
		aria-invalid={invalid || undefined}
		{...rest}
	></textarea>
	{#if showsCounter}
		<span
			aria-live="polite"
			class="pointer-events-none absolute right-3 bottom-2 font-mono text-(--text-muted) text-xs tabular-nums"
		>
			{length}/{maxlength}
		</span>
	{/if}
</div>
