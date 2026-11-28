<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { HTMLButtonAttributes } from 'svelte/elements';

interface ChipTriggerProps extends Omit<HTMLButtonAttributes, 'children'> {
	label: string;
	muted?: boolean;
	variant?: 'filled' | 'ghost';
	fullWidth?: boolean;
	ref?: HTMLButtonElement | null;
}

const BASE_CLASS =
	'group flex cursor-pointer items-center justify-between gap-x-2 text-left text-sm outline-none transition-colors duration-(--motion-quick) focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-(--text-error)/60';
const FILLED_CLASS = `h-10 px-3 ${chipFieldSurfaceClass} text-(--text-primary) hover-hover:bg-surface-5 data-[state=open]:bg-surface-5`;
const GHOST_CLASS =
	'h-8 rounded-full px-3 text-(--text-primary) hover-hover:bg-surface-5 data-[state=open]:bg-surface-5';
</script>

<script lang="ts">
import ChevronDown from '@lucide/svelte/icons/chevron-down';
import { cn } from '#lib/utils/utils.ts';
import { chipFieldSurfaceClass, chipIconSlotClass } from './chip-chrome.ts';

let {
	label,
	muted = false,
	variant = 'filled',
	fullWidth = false,
	class: className,
	ref = $bindable(null),
	...rest
}: ChipTriggerProps = $props();
</script>

<button
	bind:this={ref}
	type="button"
	{...rest}
	class={cn(
		BASE_CLASS,
		variant === 'filled' ? FILLED_CLASS : GHOST_CLASS,
		fullWidth ? 'flex w-full' : 'inline-flex',
		className
	)}
>
	<span class={cn('min-w-0 flex-1 truncate', muted && 'text-(--text-subtle)')}>
		{label}
	</span>
	<span aria-hidden="true" class={cn(chipIconSlotClass, 'opacity-50')}>
		<ChevronDown class="size-4" />
	</span>
</button>
