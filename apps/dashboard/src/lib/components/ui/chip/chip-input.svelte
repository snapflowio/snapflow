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
import type { HTMLInputAttributes } from 'svelte/elements';
import type { ChipIcon } from './chip-selection.ts';

export interface ChipInputProps extends Omit<HTMLInputAttributes, 'size'> {
	icon?: ChipIcon;
	startAdornment?: Snippet;
	endAdornment?: Snippet;
	error?: boolean;
	ref?: HTMLInputElement | null;
}
</script>

<script lang="ts">
import { cn } from '#lib/utils/utils.ts';
import { chipFieldSurfaceClass, chipFieldTextClass } from './chip-chrome.ts';

let {
	class: className,
	icon: Icon,
	startAdornment,
	endAdornment,
	error: invalid,
	disabled,
	type = 'text',
	value = $bindable(),
	ref = $bindable(null),
	...rest
}: ChipInputProps = $props();
</script>

<div
	class={cn(
		'flex h-7.5 w-full items-center gap-1.5 px-2',
		chipFieldSurfaceClass,
		invalid && 'border-(--text-error)',
		disabled && 'opacity-50',
		className
	)}
>
	{#if Icon}
		<Icon class="size-3.5 shrink-0 text-(--text-icon)" />
	{/if}
	{@render startAdornment?.()}
	<input
		bind:this={ref}
		bind:value
		{type}
		{disabled}
		class={[
			'-ml-1 h-full w-full bg-transparent indent-1 read-only:cursor-default disabled:cursor-not-allowed',
			chipFieldTextClass,
		]}
		{...rest}
	>
	{@render endAdornment?.()}
</div>
