<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Info from '@lucide/svelte/icons/info';
import {
	type DropdownMenuItemProps,
	DropdownMenu as DropdownMenuPrimitive,
} from 'bits-ui';
import type { Snippet } from 'svelte';
import Kbd from '#lib/components/ui/kbd.svelte';
import Tooltip from '#lib/components/ui/tooltip/tooltip.svelte';
import { cn } from '#lib/utils/utils.ts';
import {
	MENU_ROW_BASE_CLASS,
	MENU_ROW_HIGHLIGHT_CLASS,
	MENU_ROW_SELECTED_CLASS,
	MENU_ROW_SIZES,
	MENU_SHORTCUT_CLASS,
	type MenuRowSize,
} from './dropdown-menu-styles.ts';

interface DropdownMenuItemComponentProps extends DropdownMenuItemProps {
	inset?: boolean;
	active?: boolean;
	destructive?: boolean;
	size?: MenuRowSize;
	action?: Snippet;
	shortcut?: string | readonly string[];
	disabledReason?: string;
}

let {
	class: className,
	inset,
	active,
	destructive,
	size = 'md',
	action,
	shortcut,
	disabledReason,
	disabled,
	children,
	ref = $bindable(null),
	...rest
}: DropdownMenuItemComponentProps = $props();

const hasTrailing = $derived(Boolean(action || disabledReason));
const rowClass = $derived(
	cn(
		MENU_ROW_BASE_CLASS,
		MENU_ROW_SIZES[size],
		active ? MENU_ROW_SELECTED_CLASS : MENU_ROW_HIGHLIGHT_CLASS,
		destructive && 'text-(--text-error) [&_svg]:text-(--text-error)',
		inset && 'pl-7',
		hasTrailing && 'pr-7',
		className
	)
);
const isDisabled = $derived(Boolean(disabled || disabledReason));
</script>

{#snippet item()}
	<DropdownMenuPrimitive.Item
		bind:ref
		class={rowClass}
		disabled={isDisabled}
		{...rest}
	>
		{@render children?.()}
		{#if shortcut}
			<Kbd keys={shortcut} class={MENU_SHORTCUT_CLASS} />
		{/if}
	</DropdownMenuPrimitive.Item>
{/snippet}

{#if disabledReason}
	<div class="relative">
		{@render item()}
		<div class="absolute top-1/2 right-1 flex -translate-y-1/2 items-center">
			<Tooltip content={disabledReason}>
				{#snippet child({ props })}
					<span
						{...props}
						class="inline-flex size-5 items-center justify-center text-(--text-icon)"
					>
						<Info class="size-3.5" aria-label={disabledReason} />
					</span>
				{/snippet}
			</Tooltip>
		</div>
	</div>
{:else if action}
	<div class="group/dropdownitem relative">
		{@render item()}
		<div
			class="absolute top-1/2 right-1 flex -translate-y-1/2 items-center opacity-0 transition-opacity group-focus-within/dropdownitem:opacity-100 group-hover/dropdownitem:opacity-100 pointer-coarse:opacity-100"
		>
			{@render action()}
		</div>
	</div>
{:else}
	{@render item()}
{/if}
