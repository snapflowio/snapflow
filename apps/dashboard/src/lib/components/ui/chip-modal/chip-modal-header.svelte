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
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { findModalContent } from '#lib/components/ui/modal/modal-content.svelte.ts';
import { cn } from '#lib/utils/utils.ts';
import { findChipModalGuard, UNSAVED_HINT } from './chip-modal-guard.svelte.ts';
import { findChipModalVariant } from './chip-modal-variant.ts';

interface ChipModalHeaderProps extends HTMLAttributes<HTMLDivElement> {
	actions?: Snippet;
	onClose?: () => void;
	closeDisabled?: boolean;
	closeAriaLabel?: string;
	ref?: HTMLDivElement | null;
}

let {
	actions,
	class: className,
	children,
	onClose,
	closeDisabled,
	closeAriaLabel = 'Close',
	ref = $bindable(null),
	...rest
}: ChipModalHeaderProps = $props();

const modalContent = findModalContent();
const guard = findChipModalGuard();
const variant = findChipModalVariant();
const isSheet = $derived(variant() === 'sheet');
const closeBlocked = $derived(
	closeDisabled || modalContent?.dismissDisabled === true
);
</script>

{#snippet closeButton(props: Record<string, unknown>)}
	<button
		{...props}
		type="button"
		disabled={closeBlocked}
		class="relative inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full p-0 text-(--text-subtle) outline-none transition-colors duration-(--motion-quick) hover-hover:bg-surface-5 hover-hover:text-(--text-muted) focus-visible:focus-ring disabled:pointer-events-none disabled:opacity-50"
	>
		<X class={isSheet ? 'size-6' : 'size-4'} />
		<span class="sr-only">{closeAriaLabel}</span>
	</button>
{/snippet}

<div
	bind:this={ref}
	data-chip-modal-header=""
	class={cn(
		isSheet
			? 'flex min-w-0 shrink-0 items-center justify-between gap-2 px-8 py-6 text-lg'
			: 'flex h-9 min-w-0 items-center justify-between gap-2 pr-1 pl-4 text-sm',
		className
	)}
	{...rest}
>
	<span
		class={cn(
			'min-w-0 truncate',
			isSheet ? 'text-(--text-primary)' : 'text-(--text-subtle)'
		)}
		>{@render children?.()}</span
	>
	<div class="relative flex shrink-0 items-center gap-0.5">
		{@render actions?.()}
		{#key guard?.flashCount ?? 0}
			<span
				class={cn(
					'inline-flex rounded-sm',
					(guard?.flashCount ?? 0) > 0 &&
						'animate-[pulse_var(--motion-emphasis)_ease-out_1] motion-reduce:animate-none'
				)}
			>
				{#if onClose}
					{@render closeButton({ onclick: onClose })}
				{:else}
					<DialogPrimitive.Close disabled={closeBlocked}>
						{#snippet child({ props })}
							{@render closeButton(props)}
						{/snippet}
					</DialogPrimitive.Close>
				{/if}
			</span>
		{/key}
		{#if guard?.hinting}
			<span
				role="status"
				class="absolute top-full right-0 z-(--z-tooltip) mt-2 w-max max-w-60 rounded-md border border-border bg-surface-1 px-3 py-1.5 text-(--text-body) text-sm shadow-(--shadow-medium)"
			>
				{UNSAVED_HINT}
			</span>
		{/if}
	</div>
</div>
