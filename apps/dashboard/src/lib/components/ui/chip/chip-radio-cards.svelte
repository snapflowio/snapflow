<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { Snippet } from 'svelte';
import type { ClassValue } from 'svelte/elements';
import type { ChipIcon } from './chip-selection.ts';

export interface ChipRadioCard<TValue extends string = string> {
	value: TValue;
	title: string;
	meta?: string;
	icon?: ChipIcon;
	disabled?: boolean;
	disabledReason?: string;
}

export interface ChipRadioCardsProps<TValue extends string = string> {
	options: readonly ChipRadioCard<TValue>[];
	value?: TValue;
	onValueChange?: (value: TValue) => void;
	label: string;
	name?: string;
	disabled?: boolean;
	trailing?: Snippet<[ChipRadioCard<TValue>]>;
	class?: ClassValue;
}
</script>

<script lang="ts" generics="TValue extends string = string">
import { RadioGroup } from 'bits-ui';
import Tooltip from '#lib/components/ui/tooltip/tooltip.svelte';
import { cn } from '#lib/utils/utils.ts';

let {
	options,
	value = $bindable(),
	onValueChange,
	label,
	name,
	disabled = false,
	trailing,
	class: className,
}: ChipRadioCardsProps<TValue> = $props();

function select(next: string): void {
	const option = options.find((item) => item.value === next);
	if (!option) return;
	value = option.value;
	onValueChange?.(option.value);
}
</script>

{#snippet card(option: ChipRadioCard<TValue>)}
	<RadioGroup.Item
		value={option.value}
		disabled={option.disabled || Boolean(option.disabledReason)}
		class="group flex w-full cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface-3 px-4 py-3 text-left outline-none transition-colors duration-(--motion-quick) hover-hover:bg-surface-5 focus-visible:focus-ring data-disabled:cursor-not-allowed data-disabled:opacity-50 data-[state=checked]:border-(--accent) data-[state=checked]:bg-surface-5"
	>
		{#snippet children({ checked })}
			<span
				aria-hidden="true"
				class={cn(
					'flex size-3.5 shrink-0 items-center justify-center rounded-full border transition-colors',
					checked ? 'border-(--accent)' : 'border-(--text-subtle)'
				)}
			>
				{#if checked}
					<span class="size-1.5 rounded-full bg-(--accent)"></span>
				{/if}
			</span>
			{#if option.icon}
				<option.icon class="size-4 shrink-0 text-(--text-icon)" />
			{/if}
			<span class="flex min-w-0 flex-1 flex-col">
				<span class="truncate font-medium text-(--text-primary) text-sm">
					{option.title}
				</span>
				{#if option.meta}
					<span class="text-pretty text-(--text-muted) text-sm">
						{option.meta}
					</span>
				{/if}
			</span>
			{@render trailing?.(option)}
		{/snippet}
	</RadioGroup.Item>
{/snippet}

<RadioGroup.Root
	aria-label={label}
	{name}
	{disabled}
	value={value ?? ''}
	onValueChange={select}
	class={cn('flex flex-col gap-2', className)}
>
	{#each options as option (option.value)}
		{#if option.disabledReason}
			<Tooltip content={option.disabledReason}>
				{#snippet child({ props })}
					<div {...props}>{@render card(option)}</div>
				{/snippet}
			</Tooltip>
		{:else}
			{@render card(option)}
		{/if}
	{/each}
</RadioGroup.Root>
