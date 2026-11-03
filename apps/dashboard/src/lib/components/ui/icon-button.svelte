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
import type { HTMLButtonAttributes } from 'svelte/elements';
import {
	chipFilledFillTokens,
	chipRadiusClass,
} from '#lib/components/ui/chip/chip-chrome.ts';
import type { ChipIcon } from '#lib/components/ui/chip/chip-selection.ts';

export const iconButtonVariants = cva(
	'inline-flex cursor-pointer items-center justify-center outline-none transition-colors disabled:pointer-events-none disabled:opacity-70',
	{
		variants: {
			variant: {
				quiet:
					'text-(--text-secondary) hover-hover:bg-surface-active focus-visible:bg-surface-active data-[state=open]:bg-surface-active',
				ghost:
					'text-(--text-secondary) hover-hover:text-(--text-primary) focus-visible:text-(--text-primary) data-[state=open]:text-(--text-primary)',
				bulk: `${chipRadiusClass} ${chipFilledFillTokens} size-7 p-0 text-(--text-secondary) hover-hover:bg-brand-secondary hover-hover:text-(--text-on-brand) focus-visible:bg-brand-secondary focus-visible:text-(--text-on-brand) disabled:opacity-40 max-md:pointer-coarse:size-11`,
				'bulk-destructive': `${chipRadiusClass} ${chipFilledFillTokens} size-7 p-0 text-(--text-secondary) hover-hover:bg-destructive hover-hover:text-(--text-on-brand) focus-visible:bg-destructive focus-visible:text-(--text-on-brand) disabled:opacity-40 max-md:pointer-coarse:size-11`,
			},
			size: {
				sm: 'size-5 rounded-sm p-0 [&_svg]:stroke-[1.25]',
				md: 'size-7 rounded-lg p-0',
			},
		},
		compoundVariants: [
			{ size: 'sm', variant: 'quiet', className: 'text-(--text-icon-muted)' },
			{ size: 'sm', variant: 'ghost', className: 'text-(--text-icon-muted)' },
		],
		defaultVariants: { variant: 'quiet', size: 'sm' },
	}
);

export type IconButtonVariants = VariantProps<typeof iconButtonVariants>;

export interface IconButtonProps
	extends Omit<HTMLButtonAttributes, 'aria-label'>,
		IconButtonVariants {
	label: string;
	icon?: ChipIcon;
	ref?: HTMLButtonElement | null;
}

const ICON_SIZE_CLASS = {
	sm: 'size-3.5',
	md: 'size-4',
	bulk: 'size-3',
} as const;
</script>

<script lang="ts">
import { cn } from '#lib/utils/utils.ts';

let {
	class: className,
	label,
	icon: Icon,
	variant,
	size,
	type = 'button',
	children,
	ref = $bindable(null),
	...rest
}: IconButtonProps = $props();

const iconClass = $derived(
	variant === 'bulk' || variant === 'bulk-destructive'
		? ICON_SIZE_CLASS.bulk
		: ICON_SIZE_CLASS[size ?? 'sm']
);
</script>

<button
	bind:this={ref}
	{type}
	aria-label={label}
	class={cn(iconButtonVariants({ variant, size }), className)}
	{...rest}
>
	{#if Icon}
		<Icon class={iconClass} />
	{/if}
	{@render children?.()}
</button>
