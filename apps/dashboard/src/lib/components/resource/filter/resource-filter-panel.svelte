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
import type { ChipOption } from '#lib/components/ui/chip/chip-selection.ts';

export interface ResourceQuickFilterField<TValue extends string = string> {
	id: string;
	label: string;
	options: readonly ChipOption<TValue>[];
	values: readonly TValue[];
	onChange: (values: TValue[]) => void;
}
</script>

<script lang="ts">
import Check from '@lucide/svelte/icons/check';
import ChevronRight from '@lucide/svelte/icons/chevron-right';
import { toggleSelection } from '#lib/components/ui/chip/chip-selection.ts';
import {
	MENU_HEADING_CLASS,
	MENU_ROW_BASE_CLASS,
	MENU_ROW_SIZES,
} from '#lib/components/ui/dropdown-menu/dropdown-menu-styles.ts';
import { cn } from '#lib/utils/utils.ts';

interface ResourceFilterPanelProps {
	children?: Snippet;
	quickFields?: readonly ResourceQuickFilterField[];
}

let { children, quickFields = [] }: ResourceFilterPanelProps = $props();

let openField = $state<string | null>(null);
</script>

<div
	class="flex max-h-[70vh] w-full flex-col md:w-64 md:max-w-[calc(100vw-0.75rem)] gap-3 overflow-x-hidden overflow-y-auto p-3 text-[13px]"
>
	{#if quickFields.length > 0}
		<div class="-m-2 flex flex-col">
			{#each quickFields as field (field.id)}
				{const expanded = $derived(openField === field.id)}
				<button
					type="button"
					aria-expanded={expanded}
					class={cn(
						MENU_ROW_BASE_CLASS,
						MENU_ROW_SIZES.md,
						'w-full hover-hover:bg-surface-5 focus-visible:bg-surface-5'
					)}
					onclick={() => (openField = expanded ? null : field.id)}
				>
					<span>{field.label}</span>
					{#if field.values.length > 0}
						<span class="ml-auto text-(--text-muted) text-xs tabular-nums"
							>{field.values.length}</span
						>
					{/if}
					<ChevronRight
						class={cn(
							'transition-transform duration-(--motion-quick)',
							field.values.length === 0 && 'ml-auto',
							expanded && 'rotate-90'
						)}
					/>
				</button>
				{#if expanded}
					<fieldset class="m-0 flex flex-col border-0 p-0 pl-2">
						<legend class="sr-only">{field.label}</legend>
						{#each field.options as option (option.value)}
							{const selected = $derived(field.values.includes(option.value))}
							<button
								type="button"
								aria-pressed={selected}
								disabled={option.disabled}
								class={cn(
									MENU_ROW_BASE_CLASS,
									MENU_ROW_SIZES.sm,
									'w-full hover-hover:bg-surface-5 focus-visible:bg-surface-5'
								)}
								onclick={() =>
									field.onChange(toggleSelection(field.values, option.value))}
							>
								<span>{option.label}</span>
								{#if selected}
									<Check class="ml-auto" />
								{/if}
							</button>
						{:else}
							<span class={MENU_HEADING_CLASS}>No options</span>
						{/each}
					</fieldset>
				{/if}
			{/each}
		</div>
	{/if}
	{@render children?.()}
</div>
