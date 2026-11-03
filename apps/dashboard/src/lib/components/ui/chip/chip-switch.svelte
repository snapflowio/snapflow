<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { ClassValue } from 'svelte/elements';
import type { ChipIcon } from './chip-selection.ts';

export interface ChipSwitchOption<T extends string = string> {
	value: T;
	label: string;
	icon?: ChipIcon;
}
interface ChipSwitchProps<T extends string = string> {
	options: readonly ChipSwitchOption<T>[];
	value: T;
	onChange?: (value: T) => void;
	size?: 'default' | 'compact';
	'aria-label'?: string;
	class?: ClassValue;
	disabled?: boolean;
}
</script>

<script lang="ts" generics="T extends string">
import { RadioGroup } from 'bits-ui';
import { cn } from '#lib/utils/utils.ts';
import {
	SEGMENTED_ITEM_ACTIVE_CLASS,
	SEGMENTED_ITEM_CLASS,
	SEGMENTED_ITEM_INACTIVE_CLASS,
	SEGMENTED_TRACK_CLASS,
} from './chip-chrome.ts';

let {
	options,
	value = $bindable(),
	onChange,
	size = 'default',
	'aria-label': ariaLabel,
	class: className,
	disabled = false,
}: ChipSwitchProps<T> = $props();

function handleValueChange(next: string): void {
	const option = options.find((candidate) => candidate.value === next);
	if (!option) return;
	value = option.value;
	onChange?.(option.value);
}
</script>

<RadioGroup.Root
	{value}
	onValueChange={handleValueChange}
	orientation="horizontal"
	{disabled}
	aria-label={ariaLabel}
	class={cn(
		SEGMENTED_TRACK_CLASS,
		size === 'compact' && 'h-5.5',
		disabled && 'opacity-60',
		className
	)}
>
	{#each options as option (option.value)}
		{const Icon = $derived(option.icon)}
		{const isActive = $derived(option.value === value)}
		<RadioGroup.Item
			value={option.value}
			class={cn(
				SEGMENTED_ITEM_CLASS,
				size === 'compact' && 'px-1.5 text-xs',
				isActive ? SEGMENTED_ITEM_ACTIVE_CLASS : SEGMENTED_ITEM_INACTIVE_CLASS
			)}
		>
			{#if Icon}
				<Icon class="size-3.5 shrink-0" />
			{/if}
			{option.label}
		</RadioGroup.Item>
	{/each}
</RadioGroup.Root>
