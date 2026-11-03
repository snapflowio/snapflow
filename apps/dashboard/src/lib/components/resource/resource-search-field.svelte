<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Search from '@lucide/svelte/icons/search';
import X from '@lucide/svelte/icons/x';
import type { ClassValue } from 'svelte/elements';

interface ResourceSearchFieldProps {
	value?: string;
	onValueChange?: (value: string) => void;
	placeholder?: string;
	'aria-label'?: string;
	class?: ClassValue;
}

let {
	value = $bindable(''),
	onValueChange,
	placeholder = 'Search...',
	'aria-label': ariaLabel = 'Search resources',
	class: className,
}: ResourceSearchFieldProps = $props();

function clear(): void {
	value = '';
	onValueChange?.('');
}
</script>

<div
	class={[
		'relative flex min-w-0 flex-1 basis-full items-center gap-1.5 rounded-sm outline-none has-[input:focus-visible]:text-(--text-primary) sm:basis-auto',
		className,
	]}
>
	<Search class="pointer-events-none size-3.5 shrink-0 text-(--text-muted)" />
	<input
		type="text"
		bind:value
		oninput={() => onValueChange?.(value)}
		{placeholder}
		aria-label={ariaLabel}
		class="min-w-20 flex-1 bg-transparent py-1 text-(--text-body) text-sm outline-none placeholder:text-(--text-muted)"
	>
	{#if value}
		<button
			type="button"
			class="relative mr-0.5 flex size-3.5 shrink-0 cursor-pointer items-center justify-center rounded-sm text-(--text-muted) outline-none transition-colors before:absolute before:-inset-1.75 before:content-[''] hover-hover:text-(--text-primary) focus-visible:text-(--text-primary)"
			onclick={clear}
			aria-label="Clear search"
		>
			<X class="h-3 w-3" />
		</button>
	{/if}
</div>
