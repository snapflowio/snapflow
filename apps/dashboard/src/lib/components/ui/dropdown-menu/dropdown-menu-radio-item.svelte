<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Check from '@lucide/svelte/icons/check';
import {
	DropdownMenu as DropdownMenuPrimitive,
	type DropdownMenuRadioItemProps,
} from 'bits-ui';
import type { Snippet } from 'svelte';
import { cn } from '#lib/utils/utils.ts';
import {
	MENU_ROW_BASE_CLASS,
	MENU_ROW_CHECKED_CLASS,
	MENU_ROW_HIGHLIGHT_CLASS,
	MENU_ROW_SIZES,
	MENU_TRAILING_ICON_CLASS,
	type MenuRowSize,
} from './dropdown-menu-styles.ts';

interface DropdownMenuRadioItemComponentProps
	extends Omit<DropdownMenuRadioItemProps, 'children'> {
	size?: MenuRowSize;
	children?: Snippet;
}

let {
	class: className,
	size = 'md',
	children: label,
	ref = $bindable(null),
	...rest
}: DropdownMenuRadioItemComponentProps = $props();
</script>

<DropdownMenuPrimitive.RadioItem
	bind:ref
	class={cn(
		MENU_ROW_BASE_CLASS,
		MENU_ROW_SIZES[size],
		MENU_ROW_HIGHLIGHT_CLASS,
		MENU_ROW_CHECKED_CLASS,
		className
	)}
	{...rest}
>
	{#snippet children({ checked })}
		{@render label?.()}
		{#if checked}
			<Check aria-hidden="true" class={MENU_TRAILING_ICON_CLASS} />
		{/if}
	{/snippet}
</DropdownMenuPrimitive.RadioItem>
