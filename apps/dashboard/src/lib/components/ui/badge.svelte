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

const badgeVariants = cva(
	'inline-flex w-fit shrink-0 items-center justify-center whitespace-nowrap rounded-[0.5em] font-medium',
	{
		variants: {
			variant: {
				neutral: 'bg-(--badge-gray-bg) text-(--badge-gray-text)',
				success: 'bg-(--badge-success-bg) text-(--badge-success-text)',
				warning: 'bg-(--badge-amber-bg) text-(--badge-amber-text)',
				error: 'bg-(--badge-error-bg) text-(--badge-error-text)',
				outline: 'border border-border bg-transparent text-(--text-tertiary)',
			},
			size: {
				default: 'gap-1.5 px-[0.7em] py-[0.3em] text-sm',
				sm: 'gap-1 px-[0.5em] py-[0.2em] text-xs tabular-nums',
				pill: 'gap-1 rounded-full px-1.5 py-0.5 text-xs tabular-nums',
			},
		},
		defaultVariants: {
			variant: 'neutral',
			size: 'default',
		},
	}
);

export type BadgeVariant = NonNullable<
	VariantProps<typeof badgeVariants>['variant']
>;

export interface BadgeProps
	extends HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof badgeVariants> {
	dot?: boolean;
	live?: boolean;
	tooltip?: string;
	icon?: Component<{
		class?: string;
	}>;
}

const DOT_CLASS = 'size-1.5 shrink-0 rounded-full bg-current';
const ICON_SIZES = {
	default: 'size-3.5',
	sm: 'size-3',
	pill: 'size-3',
} as const;
</script>

<script lang="ts">
import Tooltip from '#lib/components/ui/tooltip/tooltip.svelte';
import { cn } from '#lib/utils/utils.ts';

interface BadgeComponentProps extends BadgeProps {
	ref?: HTMLDivElement | null;
}

let {
	class: className,
	variant,
	size,
	dot = false,
	live = false,
	tooltip,
	icon: Icon,
	ref = $bindable(null),
	children,
	...props
}: BadgeComponentProps = $props();

const iconClass = $derived(ICON_SIZES[size ?? 'default']);
</script>

{#snippet badge(extra: Record<string, unknown>)}
	<div
		bind:this={ref}
		{...props}
		{...extra}
		class={cn(badgeVariants({ variant, size }), className)}
	>
		{#if dot || live}
			<span
				aria-hidden="true"
				class={cn(DOT_CLASS, live && 'live-pulse')}
			></span>
		{/if}
		{#if Icon}
			<Icon class={iconClass} />
		{/if}
		{@render children?.()}
	</div>
{/snippet}

{#if tooltip}
	<Tooltip content={tooltip}>
		{#snippet child({ props: tooltipProps })}
			{@render badge({ ...tooltipProps, tabindex: 0 })}
		{/snippet}
	</Tooltip>
{:else}
	{@render badge({})}
{/if}
