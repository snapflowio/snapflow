<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import X from '@lucide/svelte/icons/x';
import { Dialog as DialogPrimitive } from 'bits-ui';
import type { Component, Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import {
	chipContentIconClass,
	chipContentLabelClass,
} from '#lib/components/ui/chip/chip-chrome.ts';
import { findModalContent } from '#lib/components/ui/modal/modal-content.svelte.ts';
import { cn } from '#lib/utils/utils.ts';
import ChipModalSeparator from './chip-modal-separator.svelte';

interface ChipModalHeaderProps extends HTMLAttributes<HTMLDivElement> {
	actions?: Snippet;
	icon?: Component<{ class?: string }> | null;
	onClose?: () => void;
	closeDisabled?: boolean;
	closeAriaLabel?: string;
	ref?: HTMLDivElement | null;
}

let {
	actions,
	class: className,
	children,
	icon: Icon = null,
	onClose,
	closeDisabled,
	closeAriaLabel = 'Close',
	ref = $bindable(null),
	...rest
}: ChipModalHeaderProps = $props();

const modalContent = findModalContent();
const closeBlocked = $derived(
	closeDisabled || modalContent?.dismissDisabled === true
);
</script>

{#snippet closeButton(
	props: Record<string, unknown>
)}
	<button
		{...props}
		type="button"
		disabled={closeBlocked}
		class='relative inline-flex size-3.5 shrink-0 cursor-pointer items-center justify-center p-0 text-(--text-icon-muted) outline-none transition-colors before:absolute before:-inset-3.5 before:content-[""] hover-hover:text-(--text-primary) focus-visible:text-(--text-primary) disabled:pointer-events-none disabled:opacity-70'
	>
		<X class="size-3.5 text-(--text-icon)" />
		<span class="sr-only">{closeAriaLabel}</span>
	</button>
{/snippet}

<div bind:this={ref} class={cn('flex flex-col', className)} {...rest}>
	<div class="flex min-w-0 items-center justify-between gap-2 px-4 pt-3">
		<div class="flex min-w-0 items-center gap-2">
			{#if Icon}
				<Icon class={chipContentIconClass} />
			{/if}
			<span class={chipContentLabelClass}>{@render children?.()}</span>
		</div>
		<div class="flex shrink-0 items-center gap-0.5">
			{@render actions?.()}
			{#if onClose}
				{@render closeButton({ onclick: onClose })}
			{:else}
				<DialogPrimitive.Close disabled={closeBlocked}>
					{#snippet child({
						props,
					})}
						{@render closeButton(props)}
					{/snippet}
				</DialogPrimitive.Close>
			{/if}
		</div>
	</div>
	<ChipModalSeparator class="mt-3" />
</div>
