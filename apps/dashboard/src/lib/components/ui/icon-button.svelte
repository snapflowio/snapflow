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
	DISABLED_STATE_CLASS,
} from '#lib/components/ui/chip/chip-chrome.ts';
import type { ChipIcon } from '#lib/components/ui/chip/chip-selection.ts';

const FILLED_BASE_CLASS = `${chipRadiusClass} ${chipFilledFillTokens} size-8 p-0 max-md:pointer-coarse:size-11`;

export const iconButtonVariants = cva(
	`relative inline-flex cursor-pointer items-center justify-center outline-none transition-colors duration-(--motion-quick) ease-out ${DISABLED_STATE_CLASS}`,
	{
		variants: {
			variant: {
				quiet:
					'text-(--text-muted) hover-hover:bg-surface-5 hover-hover:text-(--text-primary) focus-visible:bg-surface-5 data-[state=open]:bg-surface-5 data-[state=open]:text-(--text-primary)',
				ghost:
					'text-(--text-subtle) hover-hover:text-(--text-primary) focus-visible:text-(--text-primary) data-[state=open]:text-(--text-primary)',
				filled: `${FILLED_BASE_CLASS} hover-hover:bg-surface-6 focus-visible:bg-surface-6 data-[state=open]:bg-surface-6`,
				'filled-destructive': `${FILLED_BASE_CLASS} hover-hover:bg-destructive hover-hover:text-white focus-visible:bg-destructive focus-visible:text-white`,
			},
			size: {
				sm: "size-6 rounded-full p-0 max-md:pointer-coarse:before:absolute max-md:pointer-coarse:before:-inset-2.5 max-md:pointer-coarse:before:content-[''] [&_svg]:stroke-[1.25]",
				md: "size-8 rounded-full p-0 max-md:pointer-coarse:before:absolute max-md:pointer-coarse:before:-inset-1.5 max-md:pointer-coarse:before:content-['']",
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
	tooltip?: boolean;
	tooltipContent?: string;
	shortcut?: string | readonly string[];
	disabledReason?: string | null;
	preferAbove?: boolean;
	ref?: HTMLButtonElement | null;
}

const ICON_SIZE_CLASS = {
	sm: 'size-3.5',
	md: 'size-4',
	filled: 'size-4',
} as const;
</script>

<script lang="ts">
import { mergeProps } from 'bits-ui';
import Tooltip from '#lib/components/ui/tooltip/tooltip.svelte';
import { cn } from '#lib/utils/utils.ts';

let {
	class: className,
	label,
	icon: Icon,
	variant,
	size,
	tooltip = true,
	tooltipContent,
	shortcut,
	disabledReason,
	preferAbove = false,
	disabled,
	onclick,
	type = 'button',
	children,
	ref = $bindable(null),
	...rest
}: IconButtonProps = $props();

const iconClass = $derived(
	variant === 'filled' || variant === 'filled-destructive'
		? ICON_SIZE_CLASS.filled
		: ICON_SIZE_CLASS[size ?? 'sm']
);
const blocked = $derived(Boolean(disabledReason));
const tooltipText = $derived(disabledReason || tooltipContent || label);
const showsTooltip = $derived(tooltip || blocked);

function handleClick(
	event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }
): void {
	if (blocked) {
		event.preventDefault();
		event.stopPropagation();
		return;
	}
	(
		onclick as
			| ((
					event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }
			  ) => void)
			| null
			| undefined
	)?.(event);
}
</script>

{#snippet button(extra: Record<string, unknown>)}
	<button
		bind:this={ref}
		{type}
		aria-label={label}
		data-icon-button=""
		aria-disabled={blocked ? true : undefined}
		disabled={disabled && !blocked ? true : undefined}
		class={cn(iconButtonVariants({ variant, size }), className)}
		{...mergeProps(rest, extra)}
		onclick={handleClick}
	>
		{#if Icon}
			<Icon class={iconClass} />
		{/if}
		{@render children?.()}
	</button>
{/snippet}

{#if showsTooltip}
	<Tooltip
		content={tooltipText}
		shortcut={blocked ? undefined : shortcut}
		{preferAbove}
	>
		{#snippet child({ props })}
			{@render button(props)}
		{/snippet}
	</Tooltip>
{:else}
	{@render button({})}
{/if}
