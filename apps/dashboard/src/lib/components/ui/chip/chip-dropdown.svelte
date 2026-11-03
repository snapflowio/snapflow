<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { ClassValue, FocusEventHandler } from 'svelte/elements';
import type { ChipOption } from './chip-selection.ts';

const DEFAULT_PLACEHOLDER = 'Select...';
const DEFAULT_ALL_LABEL = 'All';

interface ChipDropdownBaseProps<T extends string> {
	options: readonly ChipOption<T>[];
	placeholder?: string;
	align?: 'start' | 'center' | 'end';
	matchTriggerWidth?: boolean;
	disabled?: boolean;
	fullWidth?: boolean;
	modal?: boolean;
	searchable?: boolean;
	searchPlaceholder?: string;
	class?: ClassValue;
	'aria-label'?: string;
	'aria-describedby'?: string;
	'aria-invalid'?: boolean;
	id?: string;
	onblur?: FocusEventHandler<HTMLButtonElement>;
	ref?: HTMLButtonElement | null;
}
interface ChipDropdownSingleProps<T extends string>
	extends ChipDropdownBaseProps<T> {
	multiple?: false;
	value?: T;
	onChange?: (value: T) => void;
}
interface ChipDropdownMultiProps<T extends string>
	extends ChipDropdownBaseProps<T> {
	multiple: true;
	value?: T[];
	onChange?: (values: T[]) => void;
	allLabel?: string;
	showAllOption?: boolean;
}
export type ChipDropdownProps<T extends string = string> =
	| ChipDropdownSingleProps<T>
	| ChipDropdownMultiProps<T>;

function selectedValuesOf<T extends string>(value: T | T[] | undefined): T[] {
	if (value === undefined || value === '') return [];
	return Array.isArray(value) ? value : [value];
}
</script>

<script lang="ts" generics="T extends string = string">
import DropdownMenu from '#lib/components/ui/dropdown-menu/dropdown-menu.svelte';
import DropdownMenuContent from '#lib/components/ui/dropdown-menu/dropdown-menu-content.svelte';
import DropdownMenuTrigger from '#lib/components/ui/dropdown-menu/dropdown-menu-trigger.svelte';
import { hasModalContent } from '#lib/components/ui/modal/modal-content.svelte.ts';
import ChipOptionList from './chip-option-list.svelte';
import {
	multiSelectionLabel,
	selectedOptionLabel,
	toggleSelection,
} from './chip-selection.ts';
import ChipTrigger from './chip-trigger.svelte';

let {
	ref = $bindable(null),
	value = $bindable(),
	...props
}: ChipDropdownProps<T> = $props();

const insideModal = hasModalContent();
const selectedValues = $derived(selectedValuesOf<T>(value));
const multi = $derived(
	props.multiple === true
		? {
				allLabel: props.allLabel ?? DEFAULT_ALL_LABEL,
				showAllOption: props.showAllOption !== false,
			}
		: undefined
);
const label = $derived(
	multi
		? multiSelectionLabel(props.options, selectedValues, {
				empty: multi.allLabel,
				missing: multi.allLabel,
			})
		: selectedOptionLabel(
				props.options,
				selectedValues[0],
				props.placeholder ?? DEFAULT_PLACEHOLDER
			)
);

function selectOption(option: ChipOption<T>, event: Event): void {
	if (props.multiple === true) {
		event.preventDefault();
		const next = toggleSelection(selectedValues, option.value);
		value = next;
		props.onChange?.(next);
		return;
	}
	value = option.value;
	props.onChange?.(option.value);
}

function selectAll(event: Event): void {
	event.preventDefault();
	if (props.multiple !== true) return;
	value = [];
	props.onChange?.([]);
}
</script>

<DropdownMenu modal={props.modal ?? insideModal}>
	<DropdownMenuTrigger id={props.id} disabled={props.disabled}>
		{#snippet child({
			props: triggerProps,
		})}
			<ChipTrigger
				bind:ref
				{...triggerProps}
				{label}
				muted={!multi && selectedValues.length === 0}
				disabled={props.disabled}
				fullWidth={props.fullWidth}
				aria-label={props['aria-label']}
				aria-describedby={props['aria-describedby']}
				aria-invalid={props['aria-invalid'] || undefined}
				onblur={props.onblur}
				class={[!props.fullWidth && 'w-fit max-w-60', props.class]}
			/>
		{/snippet}
	</DropdownMenuTrigger>
	<DropdownMenuContent
		align={props.align ?? 'end'}
		onOpenAutoFocus={props.searchable
			? (event: Event) => event.preventDefault()
			: undefined}
		class={[
			'min-w-40',
			(props.matchTriggerWidth ?? true) &&
				'w-(--bits-dropdown-menu-anchor-width) max-w-none',
			insideModal &&
				'max-h-[min(240px,var(--bits-dropdown-menu-content-available-height,240px))]',
		]}
	>
		<ChipOptionList
			options={props.options}
			{selectedValues}
			showSelectedCheck
			allLabel={multi?.showAllOption ? multi.allLabel : undefined}
			onSelectAll={selectAll}
			searchable={props.searchable}
			searchPlaceholder={props.searchPlaceholder}
			onSelect={selectOption}
		/>
	</DropdownMenuContent>
</DropdownMenu>
