<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import {
	type DropdownMenuItemProps,
	DropdownMenu as DropdownMenuPrimitive,
} from 'bits-ui';
import type { Snippet } from 'svelte';
import { cn } from '#lib/utils/utils.ts';
import {
	MENU_ROW_BASE_CLASS,
	MENU_ROW_HIGHLIGHT_CLASS,
	MENU_ROW_SELECTED_CLASS,
	MENU_ROW_SIZES,
	type MenuRowSize,
} from './dropdown-menu-styles.ts';

interface DropdownMenuItemComponentProps extends DropdownMenuItemProps {
	inset?: boolean;
	active?: boolean;
	destructive?: boolean;
	size?: MenuRowSize;
	action?: Snippet;
}

let {
	class: className,
	inset,
	active,
	destructive,
	size = 'md',
	action,
	ref = $bindable(null),
	...rest
}: DropdownMenuItemComponentProps = $props();

const rowClass = $derived(
	cn(
		MENU_ROW_BASE_CLASS,
		MENU_ROW_SIZES[size],
		active ? MENU_ROW_SELECTED_CLASS : MENU_ROW_HIGHLIGHT_CLASS,
		destructive && 'text-(--text-error) [&_svg]:text-(--text-error)',
		inset && 'pl-7',
		action && 'pr-7',
		className
	)
);
</script>

{#if action}
	<div class="group/dropdownitem relative">
		<DropdownMenuPrimitive.Item bind:ref class={rowClass} {...rest} />
		<div
			class="absolute top-1/2 right-1 flex -translate-y-1/2 items-center opacity-0 transition-opacity group-focus-within/dropdownitem:opacity-100 group-hover/dropdownitem:opacity-100 pointer-coarse:opacity-100"
		>
			{@render action()}
		</div>
	</div>
{:else}
	<DropdownMenuPrimitive.Item bind:ref class={rowClass} {...rest} />
{/if}
