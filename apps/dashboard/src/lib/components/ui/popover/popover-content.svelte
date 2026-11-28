<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const POPOVER_SIDE_OFFSET = 6;
const POPOVER_COLLISION_PADDING = 8;
const SHEET_CLASS =
	'fixed inset-x-0 bottom-0 z-(--z-popover) flex max-h-[80dvh] flex-col overflow-y-auto rounded-t-2xl border-border border-t bg-surface-1 px-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-(--text-body) shadow-(--shadow-overlay) animate-in slide-in-from-bottom duration-(--motion-emphasis) ease-(--ease-enter) motion-reduce:animate-none';
</script>

<script lang="ts">
import { type PopoverContentProps, Popover as PopoverPrimitive } from 'bits-ui';
import { MediaQuery } from 'svelte/reactivity';
import { breakpointQuery } from '#lib/components/layouts/breakpoints.ts';
import {
	POPOVER_ANIMATION_CLASS,
	POPOVER_SURFACE_CLASS,
} from '#lib/components/ui/chip/chip-chrome.ts';
import { cn } from '#lib/utils/utils.ts';

interface PopoverContentComponentProps extends PopoverContentProps {
	mobileSheet?: boolean;
}

let {
	class: className,
	side = 'bottom',
	align = 'start',
	sideOffset = POPOVER_SIDE_OFFSET,
	collisionPadding = POPOVER_COLLISION_PADDING,
	mobileSheet = false,
	children,
	ref = $bindable(null),
	...rest
}: PopoverContentComponentProps = $props();

const compact = new MediaQuery(breakpointQuery('max-md'));
const asSheet = $derived(mobileSheet && compact.current);
</script>

<PopoverPrimitive.Portal>
	{#if asSheet}
		<PopoverPrimitive.Content bind:ref forceMount {...rest}>
			{#snippet child({ props, open })}
				{#if open}
					<div
						aria-hidden="true"
						class="fixed inset-0 z-(--z-popover) bg-black/20 animate-in fade-in-0 duration-(--motion-quick) motion-reduce:animate-none"
					></div>
					<div {...props} class={SHEET_CLASS} data-native-surface-overlay="">
						<span
							aria-hidden="true"
							class="mx-auto my-2 block h-1 w-8 shrink-0 rounded-full bg-surface-6"
						></span>
						{@render children?.()}
					</div>
				{/if}
			{/snippet}
		</PopoverPrimitive.Content>
	{:else}
		<PopoverPrimitive.Content
			bind:ref
			{side}
			{align}
			{sideOffset}
			{collisionPadding}
			class={cn(
				POPOVER_ANIMATION_CLASS,
				POPOVER_SURFACE_CLASS,
				'z-(--z-popover) max-h-100 min-w-40 origin-(--bits-popover-content-transform-origin) overflow-y-auto p-1.5',
				className
			)}
			{children}
			{...rest}
			data-native-surface-overlay=""
		/>
	{/if}
</PopoverPrimitive.Portal>
