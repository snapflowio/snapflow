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
		'relative flex h-8 min-w-[min(100%,10rem)] flex-1 items-center rounded-full border border-border bg-surface-3 transition-colors duration-(--motion-quick) has-[input:focus-visible]:border-(--text-subtle) sm:w-76 sm:min-w-40 sm:flex-[0_1_auto]',
		className,
	]}
>
	<Search
		class="pointer-events-none absolute left-3 size-3.5 shrink-0 text-(--text-muted)"
	/>
	<input
		type="text"
		bind:value
		oninput={() => onValueChange?.(value)}
		{placeholder}
		aria-label={ariaLabel}
		class="h-full min-w-20 flex-1 bg-transparent pr-8 pl-8.5 text-(--text-primary) text-sm outline-none placeholder:text-(--text-subtle)"
	>
	{#if value}
		<button
			type="button"
			class="absolute right-1 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-(--text-subtle) outline-none transition-colors hover-hover:text-(--text-primary) focus-visible:focus-ring"
			onclick={clear}
			aria-label="Clear search"
		>
			<X class="size-3.5" />
		</button>
	{/if}
</div>
