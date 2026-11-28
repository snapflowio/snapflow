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
	count?: number;
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
import Badge from '#lib/components/ui/badge.svelte';
import {
	GLIDING_INDICATOR_CLASS,
	GLIDING_INDICATOR_MOTION_CLASS,
	GlidingIndicator,
} from '#lib/components/ui/motion/gliding-indicator.svelte.ts';
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

const indicator = new GlidingIndicator(() => value);

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
		'relative',

		disabled && 'opacity-60',
		className
	)}
	{@attach indicator.attach}
>
	{#if indicator.visible}
		<span
			aria-hidden="true"
			class={cn(
				GLIDING_INDICATOR_CLASS,
				indicator.animates && GLIDING_INDICATOR_MOTION_CLASS
			)}
			style:translate={indicator.translate}
			style:width={indicator.width}
			style:height={indicator.height}
		></span>
	{/if}
	{#each options as option (option.value)}
		{const Icon = $derived(option.icon)}
		{const isActive = $derived(option.value === value)}
		<RadioGroup.Item
			value={option.value}
			data-glide-active={isActive ? '' : undefined}
			class={cn(
				SEGMENTED_ITEM_CLASS,
				'relative',
				size === 'compact' && 'h-6 py-0',
				isActive ? SEGMENTED_ITEM_ACTIVE_CLASS : SEGMENTED_ITEM_INACTIVE_CLASS
			)}
		>
			{#if Icon}
				<Icon class="size-3.5 shrink-0" />
			{/if}
			{option.label}
			{#if option.count !== undefined}
				<Badge size="pill">{option.count}</Badge>
			{/if}
		</RadioGroup.Item>
	{/each}
</RadioGroup.Root>
