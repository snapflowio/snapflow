<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { cva, type VariantProps } from 'class-variance-authority';
import type { Component } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

const STATUS_BASE = 'gap-1.5 rounded-md';
const badgeVariants = cva(
	'inline-flex shrink-0 items-center whitespace-nowrap',
	{
		variants: {
			variant: {
				default:
					'gap-1 rounded-[40px] border border-border bg-surface-4 text-(--text-secondary)',
				outline:
					'gap-1 rounded-[40px] border border-border bg-transparent text-(--text-secondary)',
				type: 'gap-1 rounded-[40px] border border-border bg-surface-6 text-(--text-secondary)',
				green: `${STATUS_BASE} bg-(--badge-success-bg) text-(--badge-success-text)`,
				red: `${STATUS_BASE} bg-(--badge-error-bg) text-(--badge-error-text)`,
				gray: `${STATUS_BASE} bg-(--badge-gray-bg) text-(--badge-gray-text)`,
				blue: `${STATUS_BASE} bg-(--badge-blue-bg) text-(--badge-blue-text)`,
				purple: `${STATUS_BASE} bg-(--badge-purple-bg) text-(--badge-purple-text)`,
				primary: `${STATUS_BASE} bg-(--badge-purple-bg) text-(--badge-purple-text)`,
				orange: `${STATUS_BASE} bg-(--badge-orange-bg) text-(--badge-orange-text)`,
				amber: `${STATUS_BASE} bg-(--badge-amber-bg) text-(--badge-amber-text)`,
				pink: `${STATUS_BASE} bg-(--badge-pink-bg) text-(--badge-pink-text)`,
				'gray-secondary': `${STATUS_BASE} bg-surface-4 text-(--text-secondary)`,
			},
			size: {
				sm: 'px-1.75 py-px text-xs',
				md: 'px-2.25 py-0.5 text-caption',
				lg: 'px-2.25 py-[2.25px] text-caption',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'md',
		},
	}
);
const STATUS_VARIANTS: ReadonlySet<string> = new Set([
	'green',
	'red',
	'gray',
	'blue',
	'purple',
	'primary',
	'orange',
	'amber',
	'pink',
	'gray-secondary',
]);
const DOT_SIZES: Record<string, string> = {
	sm: 'size-1.25',
	md: 'size-1.5',
	lg: 'size-1.5',
};
const ICON_SIZES: Record<string, string> = {
	sm: 'size-2.5',
	md: 'size-3',
	lg: 'size-3',
};
export interface BadgeProps
	extends HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof badgeVariants> {
	dot?: boolean;
	icon?: Component<{
		class?: string;
	}>;
}
</script>

<script lang="ts">
import { cn } from '#lib/utils/utils.ts';

interface BadgeComponentProps extends BadgeProps {
	ref?: HTMLDivElement | null;
}

let {
	class: className,
	variant,
	size,
	dot = false,
	icon: Icon,
	ref = $bindable(null),
	children,
	...props
}: BadgeComponentProps = $props();

const isStatusVariant = $derived(
	variant != null && STATUS_VARIANTS.has(variant)
);
const effectiveSize = $derived(size ?? 'md');
</script>

<div
	bind:this={ref}
	class={cn(badgeVariants({ variant, size }), className)}
	{...props}
>
	{#if isStatusVariant && dot}
		<div class={cn('rounded-xs bg-current', DOT_SIZES[effectiveSize])}></div>
	{/if}
	{#if Icon}
		<Icon class={ICON_SIZES[effectiveSize]} />
	{/if}
	{@render children?.()}
</div>
