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
	chipContentIconClass,
	chipContentLabelClass,
	chipFilledFillTokens,
	chipGeometryUnroundedClass,
	chipHoverSurfaceClass,
	chipOpenSurfaceClass,
	chipPrimaryFillTokens,
	chipRadiusClass,
	DISABLED_STATE_CLASS,
	FOCUS_RING_CLASS,
	MOBILE_TOUCH_TARGET_CLASS,
} from './chip-chrome.ts';
import type { ChipIcon } from './chip-selection.ts';

const PRIMARY_CLASS = chipPrimaryFillTokens;
const SECONDARY_CLASS = `${chipFilledFillTokens} hover-hover:bg-surface-6 data-[state=open]:bg-surface-6`;
const DESTRUCTIVE_SECONDARY_CLASS = `${SECONDARY_CLASS} text-(--text-error)`;
const OUTLINE_CLASS = `border border-border bg-transparent text-(--text-primary) ${chipHoverSurfaceClass} ${chipOpenSurfaceClass}`;

export const chipVariants = cva(
	`group relative cursor-pointer ${chipGeometryUnroundedClass} ${chipRadiusClass} outline-none transition-colors duration-(--motion-quick) ease-out ${FOCUS_RING_CLASS} ${DISABLED_STATE_CLASS} aria-busy:cursor-progress ${MOBILE_TOUCH_TARGET_CLASS}`,
	{
		variants: {
			variant: {
				default: `bg-transparent text-(--text-primary) ${chipOpenSurfaceClass}`,
				ghost: `bg-transparent text-(--text-primary) ${chipOpenSurfaceClass}`,
				secondary: SECONDARY_CLASS,
				primary: PRIMARY_CLASS,
				destructive:
					'bg-destructive text-white hover-hover:bg-(--destructive-hover)',
				outline: OUTLINE_CLASS,
				'destructive-secondary': DESTRUCTIVE_SECONDARY_CLASS,
			},
			size: {
				default: '',
				compact: 'h-8 gap-1.5 px-3 text-xs',
			},
			active: { true: '', false: '' },
			fullWidth: { true: 'flex w-full', false: 'inline-flex' },
		},
		compoundVariants: [
			{
				variant: ['default', 'ghost'],
				active: false,
				className: chipHoverSurfaceClass,
			},
			{
				variant: ['default', 'ghost', 'secondary'],
				active: true,
				className: chipActiveSurfaceClass,
			},
		],
		defaultVariants: {
			variant: 'default',
			size: 'default',
			active: false,
			fullWidth: false,
		},
	}
);

export type ChipVariant =
	| 'primary'
	| 'secondary'
	| 'ghost'
	| 'destructive'
	| 'outline'
	| 'destructive-secondary';

export type ChipSize = 'default' | 'compact';

export interface ChipProps
	extends Omit<HTMLButtonAttributes, 'children'>,
		Omit<VariantProps<typeof chipVariants>, 'variant' | 'size'> {
	variant?: ChipVariant;
	size?: ChipSize;
	leftIcon?: ChipIcon;
	rightIcon?: ChipIcon;
	left?: Snippet;
	right?: Snippet;
	mobileIconOnly?: boolean;
	loading?: boolean;
	disabledReason?: string | null;
	shortcut?: string | readonly string[];
	children?: Snippet;
	href?: string;
	target?: HTMLAnchorAttributes['target'];
	rel?: string;
	download?: HTMLAnchorAttributes['download'];
	ref?: HTMLButtonElement | HTMLAnchorElement | null;
}

const MOBILE_ICON_ONLY_CLASS =
	'max-md:aspect-square max-md:justify-center max-md:gap-0 max-md:px-0';
const INVERSE_VARIANTS: ReadonlySet<ChipVariant> = new Set([
	'primary',
	'destructive',
]);
const NO_PROPS: Record<string, unknown> = {};
</script>

<script lang="ts">
import { mergeProps } from 'bits-ui';
import Kbd from '#lib/components/ui/kbd.svelte';
import { overflowFade } from '#lib/components/ui/overflow/overflow-fade.ts';
import Spinner from '#lib/components/ui/spinner.svelte';
import Tooltip from '#lib/components/ui/tooltip/tooltip.svelte';
import { cn } from '#lib/utils/utils.ts';

let {
	class: className,
	variant,
	size,
	active,
	fullWidth,
	leftIcon: LeftIcon,
	rightIcon: RightIcon,
	left,
	right,
	mobileIconOnly = false,
	loading = false,
	disabledReason,
	shortcut,
	disabled,
	onclick,
	children,
	href,
	target,
	rel,
	download,
	ref = $bindable(null),
	...rest
}: ChipProps = $props();

const isInverse = $derived(
	variant !== undefined && INVERSE_VARIANTS.has(variant)
);
const hasLeft = $derived(Boolean(left || LeftIcon));
const spinnerInLeftSlot = $derived(loading && hasLeft);
const spinnerOverLabel = $derived(loading && !hasLeft);
const blocked = $derived(Boolean(disabledReason));
const classes = $derived(
	cn(
		chipVariants({ variant, size, active, fullWidth }),
		mobileIconOnly && MOBILE_ICON_ONLY_CLASS,
		className
	)
);
const iconClass = chipContentIconClass;
const labelClass = $derived(
	cn(
		chipContentLabelClass,
		fullWidth && 'flex-1 text-center',
		spinnerOverLabel && 'invisible',
		mobileIconOnly && 'max-md:sr-only'
	)
);
const stateProps = $derived({
	disabled: (disabled || loading) && !blocked ? true : undefined,
	'aria-disabled': blocked ? true : undefined,
	'aria-busy': loading ? true : undefined,
});

function handleClick(
	event: MouseEvent & { currentTarget: EventTarget & HTMLElement }
): void {
	if (blocked || loading) {
		event.preventDefault();
		event.stopPropagation();
		return;
	}
	(
		onclick as
			| ((
					event: MouseEvent & { currentTarget: EventTarget & HTMLElement }
			  ) => void)
			| null
			| undefined
	)?.(event);
}
</script>

{#snippet content()}
	{#if spinnerInLeftSlot}
		<Spinner class={cn(iconClass, 'size-4')} />
	{:else if left}
		{@render left()}
	{:else if LeftIcon}
		<LeftIcon class={iconClass} />
	{/if}
	{#if children}
		<span class={labelClass} {@attach overflowFade}>{@render children()}</span>
	{/if}
	{#if shortcut}
		<Kbd
			keys={shortcut}
			tone={isInverse ? 'inverse' : 'default'}
			class="max-md:hidden"
		/>
	{/if}
	{#if right}
		{@render right()}
	{:else if RightIcon}
		<RightIcon class={iconClass} />
	{/if}
	{#if spinnerOverLabel}
		<span class="absolute inset-0 flex items-center justify-center">
			<Spinner class={cn(iconClass, 'size-4')} />
		</span>
	{/if}
{/snippet}

{#snippet element(extra: Record<string, unknown>)}
	{#if href !== undefined}
		<a
			bind:this={ref}
			{...mergeProps(rest, extra) as unknown as HTMLAnchorAttributes}
			{...stateProps}
			href={blocked ? undefined : href}
			{target}
			{rel}
			{download}
			class={classes}
			onclick={handleClick}
		>
			{@render content()}
		</a>
	{:else}
		<button
			bind:this={ref}
			{...mergeProps(rest, extra)}
			{...stateProps}
			type={rest.type ?? 'button'}
			class={classes}
			onclick={handleClick}
		>
			{@render content()}
		</button>
	{/if}
{/snippet}

{#if disabledReason}
	<Tooltip content={disabledReason}>
		{#snippet child({ props })}
			{@render element(props)}
		{/snippet}
	</Tooltip>
{:else}
	{@render element(NO_PROPS)}
{/if}
