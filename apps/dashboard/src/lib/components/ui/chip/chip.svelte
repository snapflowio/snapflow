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
import type { Snippet } from 'svelte';
import type {
	HTMLAnchorAttributes,
	HTMLButtonAttributes,
} from 'svelte/elements';
import {
	chipActiveSurfaceClass,
	chipBorderShadowRing,
	chipContentIconClass,
	chipContentLabelClass,
	chipFilledFillTokens,
	chipFocusSurfaceClass,
	chipGeometryUnroundedClass,
	chipHoverSurfaceClass,
	chipPrimaryFillTokens,
	chipRadiusClass,
	MOBILE_TOUCH_TARGET_CLASS,
} from './chip-chrome.ts';
import type { ChipIcon } from './chip-selection.ts';

export const chipVariants = cva(
	`group cursor-pointer ${chipGeometryUnroundedClass} outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 ${MOBILE_TOUCH_TARGET_CLASS}`,
	{
		variants: {
			variant: {
				default: '',
				filled: chipFilledFillTokens,
				primary: `${chipPrimaryFillTokens} hover-hover:brightness-110 focus-visible:brightness-110`,
				destructive:
					'bg-destructive text-white hover-hover:brightness-106 focus-visible:brightness-106',
				'border-shadow': `bg-surface-2 ${chipBorderShadowRing} hover-hover:bg-surface-4 focus-visible:bg-surface-4`,
				border: `${chipBorderShadowRing} ${chipHoverSurfaceClass} ${chipFocusSurfaceClass}`,
				outline:
					'border border-border bg-transparent hover-hover:border-[color-mix(in_srgb,var(--border)_80%,var(--text-secondary))] focus-visible:border-[color-mix(in_srgb,var(--border)_80%,var(--text-secondary))]',
			},
			shape: { default: chipRadiusClass, round: 'rounded-full' },
			active: { true: '', false: '' },
			fullWidth: { true: 'flex w-full', false: 'inline-flex' },
		},
		compoundVariants: [
			{
				variant: ['default', 'filled'],
				active: false,
				className: `${chipHoverSurfaceClass} ${chipFocusSurfaceClass}`,
			},
			{
				variant: ['default', 'filled'],
				active: true,
				className: chipActiveSurfaceClass,
			},
		],
		defaultVariants: {
			variant: 'default',
			shape: 'default',
			active: false,
			fullWidth: false,
		},
	}
);

export type ChipVariant =
	| 'primary'
	| 'destructive'
	| 'border-shadow'
	| 'border'
	| 'outline';

export interface ChipProps
	extends Omit<HTMLButtonAttributes, 'children'>,
		Omit<VariantProps<typeof chipVariants>, 'variant'> {
	variant?: ChipVariant;
	leftIcon?: ChipIcon;
	rightIcon?: ChipIcon;
	left?: Snippet;
	right?: Snippet;
	mobileIconOnly?: boolean;
	children?: Snippet;
	href?: string;
	target?: HTMLAnchorAttributes['target'];
	rel?: string;
	download?: HTMLAnchorAttributes['download'];
	ref?: HTMLButtonElement | HTMLAnchorElement | null;
}

const MOBILE_ICON_ONLY_CLASS =
	'max-md:size-7.5 max-md:justify-center max-md:gap-0 max-md:px-0';
</script>

<script lang="ts">
import { overflowFade } from '#lib/components/ui/overflow/overflow-fade.ts';
import { cn } from '#lib/utils/utils.ts';

let {
	class: className,
	variant,
	active,
	fullWidth,
	shape,
	leftIcon: LeftIcon,
	rightIcon: RightIcon,
	left,
	right,
	mobileIconOnly = false,
	children,
	href,
	target,
	rel,
	download,
	ref = $bindable(null),
	...rest
}: ChipProps = $props();

const isInverse = $derived(variant === 'primary' || variant === 'destructive');
const classes = $derived(
	cn(
		chipVariants({ variant, active, fullWidth, shape }),
		mobileIconOnly && MOBILE_ICON_ONLY_CLASS,
		className
	)
);
const iconClass = $derived(
	cn(chipContentIconClass, isInverse && 'text-current')
);
const labelClass = $derived(
	cn(
		chipContentLabelClass,
		fullWidth && 'flex-1',
		isInverse && 'text-current',
		mobileIconOnly && 'max-md:sr-only'
	)
);
const anchorProps = $derived(rest as unknown as HTMLAnchorAttributes);
</script>

{#snippet content()}
	{#if left}
		{@render left()}
	{:else if LeftIcon}
		<LeftIcon class={iconClass} />
	{/if}
	{#if children}
		<span class={labelClass} {@attach overflowFade}>{@render children()}</span>
	{/if}
	{#if right}
		{@render right()}
	{:else if RightIcon}
		<RightIcon class={iconClass} />
	{/if}
{/snippet}

{#if href !== undefined}
	<a
		bind:this={ref}
		{...anchorProps}
		{href}
		{target}
		{rel}
		{download}
		class={classes}
	>
		{@render content()}
	</a>
{:else}
	<button
		bind:this={ref}
		{...rest}
		type={rest.type ?? 'button'}
		class={classes}
	>
		{@render content()}
	</button>
{/if}
