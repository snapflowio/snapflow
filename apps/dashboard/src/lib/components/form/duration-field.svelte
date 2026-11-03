<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const CUSTOM_DURATION_VALUE = '__custom_duration__';
const DEFAULT_CUSTOM_DURATION_MINUTES = '1';
</script>

<script lang="ts">
import ChipDropdown from '#lib/components/ui/chip/chip-dropdown.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import type { ChipOption } from '#lib/components/ui/chip/chip-selection.ts';
import Label from '#lib/components/ui/label.svelte';
import FieldContentView, {
	type FieldContent,
	fieldContentText,
} from './field-content.svelte';
import FieldError from './field-error.svelte';
import { firstFieldError } from './field-errors.ts';
import { FIELD_LABEL_CLASS, fieldClass } from './field-layout.ts';
import { useFieldContext } from './form-context.ts';

interface DurationFieldProps {
	disabled?: boolean;
	hint?: FieldContent;
	label: FieldContent;
	minimum?: number;
	options: readonly ChipOption[];
}

let {
	disabled,
	hint,
	label,
	minimum = 0,
	options,
}: DurationFieldProps = $props();

const field = useFieldContext<string>();
const inputId = $props.id();
const customInputId = `${inputId}-custom`;
const errorId = `${inputId}-error`;
const hintId = `${inputId}-hint`;
const hasError = $derived(Boolean(firstFieldError(field.state.meta.errors)));
let customSelected = $state(false);
const isCustom = $derived(
	customSelected || !options.some(({ value }) => value === field.state.value)
);
const describedBy = $derived(hasError ? errorId : hint ? hintId : undefined);
const dropdownOptions = $derived([
	...options,
	{ label: 'Custom duration...', value: CUSTOM_DURATION_VALUE },
]);

function selectDuration(value: string) {
	const custom = value === CUSTOM_DURATION_VALUE;
	customSelected = custom;
	field.handleChange(custom ? DEFAULT_CUSTOM_DURATION_MINUTES : value);
}

const wrapperClass = fieldClass();
</script>

<div class={wrapperClass}>
	<Label for={isCustom ? customInputId : inputId} class={FIELD_LABEL_CLASS}>
		<FieldContentView content={label} />
	</Label>
	<ChipDropdown
		id={inputId}
		fullWidth
		align="start"
		aria-label={fieldContentText(label)}
		aria-describedby={describedBy}
		aria-invalid={!isCustom && hasError}
		{disabled}
		options={dropdownOptions}
		value={isCustom ? CUSTOM_DURATION_VALUE : field.state.value}
		onblur={field.handleBlur}
		onChange={selectDuration}
	/>
	{#if isCustom}
		<div class="flex items-center gap-2">
			<ChipInput
				id={customInputId}
				name={field.name}
				type="number"
				inputmode="numeric"
				min={minimum}
				value={field.state.value}
				onblur={field.handleBlur}
				oninput={(event) => field.handleChange(event.currentTarget.value)}
				aria-describedby={describedBy}
				aria-invalid={hasError || undefined}
			/>
			<span class="shrink-0 text-sm text-(--text-muted)">minutes</span>
		</div>
	{/if}
	{#if hint && !hasError}
		<p id={hintId} class="text-(--text-muted) text-caption">
			<FieldContentView content={hint} />
		</p>
	{/if}
	<FieldError id={errorId} errors={field.state.meta.errors} />
</div>
