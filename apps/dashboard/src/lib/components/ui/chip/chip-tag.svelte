<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const CHIP_TAG_VARIANTS = {
	mono: 'bg-surface-5 text-(--text-body)',
	gray: 'border border-border text-(--text-secondary)',
	solid: 'bg-brand text-(--text-on-brand)',
} as const;

export type ChipTagVariant = keyof typeof CHIP_TAG_VARIANTS;
</script>

<script lang="ts">
import X from '@lucide/svelte/icons/x';
import type { Snippet } from 'svelte';
import type { ClassValue } from 'svelte/elements';
import { cn } from '#lib/utils/utils.ts';

interface ChipTagProps {
	variant?: ChipTagVariant;
	children: Snippet;
	onRemove?: () => void;
	removeLabel?: string;
	class?: ClassValue;
}

let {
	variant = 'mono',
	children,
	onRemove,
	removeLabel = 'Remove',
	class: className,
}: ChipTagProps = $props();
</script>

<span
	class={cn(
		'inline-flex h-5 max-w-full shrink-0 items-center gap-0.75 rounded-md px-1 text-sm leading-none',
		CHIP_TAG_VARIANTS[variant],
		className
	)}
>
	<span class="min-w-0 truncate">{@render children()}</span>
	{#if onRemove}
		<button
			type="button"
			aria-label={removeLabel}
			onclick={onRemove}
			class="relative flex size-3 shrink-0 cursor-pointer items-center justify-center opacity-70 outline-none before:absolute before:-inset-2 before:content-[''] hover-hover:opacity-100 focus-visible:opacity-100"
		>
			<X class="size-3" />
		</button>
	{/if}
</span>
