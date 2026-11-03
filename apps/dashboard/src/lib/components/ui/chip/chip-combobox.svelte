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
import Spinner from '#lib/components/ui/spinner.svelte';
import { cn } from '#lib/utils/utils.ts';
import {
	chipFieldSurfaceClass,
	chipFieldTextClass,
	chipIconSlotClass,
} from './chip-chrome.ts';
import {
	filterOptions,
	multiSelectionLabel,
	selectedOptionLabel,
} from './chip-selection.ts';

let { value = $bindable(), ...props }: ChipComboboxProps<T> = $props();

let open = $state(false);
let search = $state('');
const visibleOptions = $derived(filterOptions(props.options, search));
const selectedValues = $derived<readonly string[]>(
	value === undefined ? [] : Array.isArray(value) ? value : [value]
);
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
			'relative flex h-7.5 items-center gap-1.5 px-2',
			props.fullWidth ? 'w-full' : 'w-60 max-w-full',
			props.error && 'border-(--text-error)',
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
				'-ml-1 h-full min-w-0 flex-1 bg-transparent indent-1',
				selectionLabel && 'placeholder:text-(--text-body)'
			)}
		/>
		<Combobox.Trigger
			aria-label="Show options"
			class={cn(chipIconSlotClass, 'cursor-pointer text-(--text-icon)')}
		>
			<ChevronDown class="size-3.5" />
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
				<div
					class="flex items-center justify-center gap-2 py-3.5 text-(--text-muted) text-caption"
				>
					<Spinner />
					Loading options...
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
							'data-highlighted:bg-surface-hover data-selected:bg-surface-active'
						)}
					>
						{#snippet children({
							selected,
						})}
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
					<div class="px-2 py-4 text-center text-(--text-muted) text-small">
						{props.emptyLabel ?? DEFAULT_EMPTY_LABEL}
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
