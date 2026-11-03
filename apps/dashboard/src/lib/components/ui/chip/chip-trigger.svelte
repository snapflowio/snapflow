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
</script>

<script lang="ts">
import ChevronDown from '@lucide/svelte/icons/chevron-down';
import { cn } from '#lib/utils/utils.ts';
import { chipVariants } from './chip.svelte';
import {
	chipContentLabelClass,
	chipIconSlotClass,
	TRIGGER_BORDER_CLASS,
} from './chip-chrome.ts';

let {
	label,
	muted = false,
	variant = 'filled',
	fullWidth = false,
	class: className,
	ref = $bindable(null),
	...rest
}: ChipTriggerProps = $props();

const filled = $derived(variant === 'filled');
</script>

<button
	bind:this={ref}
	type="button"
	{...rest}
	class={cn(
		chipVariants({ variant: filled ? 'filled' : 'default', fullWidth }),
		filled && TRIGGER_BORDER_CLASS,
		'data-[state=open]:bg-surface-active',
		className
	)}
>
	<span
		class={cn(
			chipContentLabelClass,
			'flex-1 truncate',
			muted && 'text-(--text-muted)'
		)}
	>
		{label}
	</span>
	<span aria-hidden="true" class={cn(chipIconSlotClass, 'text-(--text-icon)')}>
		<ChevronDown class="size-3.5" />
	</span>
</button>
