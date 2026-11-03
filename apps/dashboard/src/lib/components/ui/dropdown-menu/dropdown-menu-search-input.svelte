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
import type { HTMLInputAttributes } from 'svelte/elements';
import {
	chipContentGap,
	chipFieldSurfaceClass,
} from '#lib/components/ui/chip/chip-chrome.ts';
import { cn } from '#lib/utils/utils.ts';
import { MENU_ROW_HEIGHT_CLASS } from './dropdown-menu-styles.ts';

interface DropdownMenuSearchInputProps extends HTMLInputAttributes {
	ref?: HTMLInputElement | null;
}

let {
	class: className,
	onkeydown,
	value = $bindable(),
	ref = $bindable(null),
	...rest
}: DropdownMenuSearchInputProps = $props();

function focusOnMount(input: HTMLInputElement): void {
	input.focus();
}

function handleKeydown(
	event: KeyboardEvent & { currentTarget: EventTarget & HTMLInputElement }
): void {
	event.stopPropagation();
	onkeydown?.(event);
}
</script>

<div
	class={cn(
		`mt-0.5 mb-0.5 flex ${MENU_ROW_HEIGHT_CLASS} shrink-0 items-center ${chipContentGap} px-2`,
		chipFieldSurfaceClass
	)}
>
	<Search class="size-3.5 shrink-0 text-(--text-muted)" />
	<input
		bind:this={ref}
		bind:value
		{@attach focusOnMount}
		onkeydown={handleKeydown}
		class={cn(
			'h-full w-full bg-transparent text-(--text-body) text-small outline-none placeholder:text-(--text-muted) focus:outline-none',
			className
		)}
		{...rest}
	>
</div>
