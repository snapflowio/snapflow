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
import type { ChipOption } from './chip-selection.ts';

const DEFAULT_PLACEHOLDER = 'Search...';
const DEFAULT_EMPTY_LABEL = 'No results';
const COMBOBOX_SIDE_OFFSET = 6;
const LOADING_ROW_COUNT = 3;
const LOADING_ROW_OPACITIES = Array.from(
	{ length: LOADING_ROW_COUNT },
	(_, index) => 1 - index / LOADING_ROW_COUNT
);

interface ChipComboboxBaseProps<T extends string> {
	options: readonly ChipOption<T>[];
	placeholder?: string;
	emptyLabel?: string;
	loading?: boolean;
	disabled?: boolean;
	fullWidth?: boolean;
	error?: boolean;
	id?: string;
	class?: ClassValue;
	'aria-label'?: string;
}
interface ChipComboboxSingleProps<T extends string>
	extends ChipComboboxBaseProps<T> {
	multiple?: false;
	value?: T;
	onChange?: (value: T) => void;
}
interface ChipComboboxMultiProps<T extends string>
	extends ChipComboboxBaseProps<T> {
	multiple: true;
	value?: T[];
	onChange?: (values: T[]) => void;
}
export type ChipComboboxProps<T extends string = string> =
	| ChipComboboxSingleProps<T>
	| ChipComboboxMultiProps<T>;
</script>

<script lang="ts" generics="T extends string = string">
import Check from '@lucide/svelte/icons/check';
import ChevronDown from '@lucide/svelte/icons/chevron-down';
import { Combobox } from 'bits-ui';
import {
	MENU_CONTENT_CLASS,
	MENU_ROW_BASE_CLASS,
	MENU_ROW_SIZES,
} from '#lib/components/ui/dropdown-menu/dropdown-menu-styles.ts';
import Skeleton from '#lib/components/ui/skeleton/skeleton.svelte';
import { cn } from '#lib/utils/utils.ts';
import {
	chipFieldSurfaceClass,
	chipFieldTextClass,
	chipIconSlotClass,
} from './chip-chrome.ts';
import { CHIP_FIELD_FOCUS_CLASS } from './chip-input.svelte';
import {
	filterOptions,
	multiSelectionLabel,
	selectedOptionLabel,
} from './chip-selection.ts';

let { value = $bindable(), ...props }: ChipComboboxProps<T> = $props();

let open = $state(false);
let search = $state('');
const visibleOptions = $derived(filterOptions(props.options, search));
const selectedValues = $derived.by((): readonly string[] => {
	if (value === undefined) return [];
	return Array.isArray(value) ? value : [value];
});
const selectionLabel = $derived(
	props.multiple === true
		? multiSelectionLabel(props.options, selectedValues as T[], {
				empty: '',
				missing: '',
			})
		: selectedOptionLabel(props.options, selectedValues[0] as T, '')
);

function findOption(next: string): ChipOption<T> | undefined {
	return props.options.find((option) => option.value === next);
}

function handleSingleChange(next: string): void {
	const option = findOption(next);
	if (!option || props.multiple === true) return;
	value = option.value;
	props.onChange?.(option.value);
}

function handleMultipleChange(next: string[]): void {
	if (props.multiple !== true) return;
	const values = next.flatMap((item) => {
		const option = findOption(item);
		return option ? [option.value] : [];
	});
	value = values;
	props.onChange?.(values);
}

function handleOpenChange(next: boolean): void {
	open = next;
	if (!next) search = '';
}
</script>

{#snippet field()}
	<div
		class={cn(
			chipFieldSurfaceClass,
			'relative flex h-10 items-center gap-2 px-3',
			props.fullWidth ? 'w-full' : 'w-60 max-w-full',
			!props.disabled && CHIP_FIELD_FOCUS_CLASS,
			props.error && 'border-(--text-error)/60',
			props.disabled && 'opacity-50',
			props.class
		)}
	>
		<Combobox.Input
			id={props.id}
			aria-label={props['aria-label']}
			placeholder={selectionLabel || props.placeholder || DEFAULT_PLACEHOLDER}
			oninput={(event) => {
				search = event.currentTarget.value;
			}}
			class={cn(
				chipFieldTextClass,
				'h-full min-w-0 flex-1 bg-transparent',
				selectionLabel && 'placeholder:text-(--text-primary)'
			)}
		/>
		<Combobox.Trigger
			aria-label="Show options"
			class={cn(chipIconSlotClass, 'cursor-pointer opacity-50')}
		>
			<ChevronDown class="size-4" />
		</Combobox.Trigger>
	</div>
{/snippet}

{#snippet content()}
	<Combobox.Portal>
		<Combobox.Content
			sideOffset={COMBOBOX_SIDE_OFFSET}
			class={cn(
				MENU_CONTENT_CLASS,
				'max-h-60 w-(--bits-combobox-anchor-width) min-w-40'
			)}
			data-native-surface-overlay=""
		>
			{#if props.loading}
				<div role="status" aria-busy="true" class="flex flex-col gap-1 p-1">
					<span class="sr-only">Loading options</span>
					{#each LOADING_ROW_OPACITIES as opacity (opacity)}
						<div class="flex h-7 items-center px-2" style:opacity>
							<Skeleton decorative delayMs={0} class="h-3 w-2/3" />
						</div>
					{/each}
				</div>
			{:else}
				{#each visibleOptions as option (option.value)}
					<Combobox.Item
						value={option.value}
						label={option.label}
						disabled={option.disabled}
						class={cn(
							MENU_ROW_BASE_CLASS,
							MENU_ROW_SIZES.md,
							'data-highlighted:bg-surface-5 data-selected:text-(--text-primary)'
						)}
					>
						{#snippet children({ selected })}
							{#if option.icon}
								<option.icon />
							{/if}
							<span>{option.label}</span>
							{#if selected}
								<Check class="ml-auto" />
							{/if}
						{/snippet}
					</Combobox.Item>
				{:else}
					<div class="px-2 py-4 text-center text-(--text-subtle) text-[13px]">
						{search.trim()
							? `No results for “${search.trim()}”`
							: (props.emptyLabel ?? DEFAULT_EMPTY_LABEL)}
					</div>
				{/each}
			{/if}
		</Combobox.Content>
	</Combobox.Portal>
{/snippet}

{#if props.multiple === true}
	<Combobox.Root
		type="multiple"
		value={[...selectedValues]}
		onValueChange={handleMultipleChange}
		{open}
		onOpenChange={handleOpenChange}
		disabled={props.disabled}
	>
		{@render field()}
		{@render content()}
	</Combobox.Root>
{:else}
	<Combobox.Root
		type="single"
		value={selectedValues[0] ?? ''}
		onValueChange={handleSingleChange}
		{open}
		onOpenChange={handleOpenChange}
		disabled={props.disabled}
	>
		{@render field()}
		{@render content()}
	</Combobox.Root>
{/if}
