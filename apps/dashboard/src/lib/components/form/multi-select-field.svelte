<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ChipDropdown from '#lib/components/ui/chip/chip-dropdown.svelte';
import Label from '#lib/components/ui/label.svelte';
import FieldContentView, { fieldContentText } from './field-content.svelte';
import FieldError from './field-error.svelte';
import { firstFieldError } from './field-errors.ts';
import {
	FIELD_HINT_CLASS,
	fieldClass,
	fieldLabelClass,
} from './field-layout.ts';
import { useFieldContext } from './form-context.ts';
import type { SelectFieldProps } from './select-field.svelte';

interface MultiSelectFieldProps extends SelectFieldProps {
	searchable?: boolean;
	emptyLabel?: string;
}

let {
	class: className,
	disabled,
	emptyLabel,
	hint,
	id,
	label,
	options,
	placeholder,
	searchable = false,
}: MultiSelectFieldProps = $props();

const field = useFieldContext<string[]>();
const fallbackId = $props.id();
const inputId = $derived(id ?? fallbackId);
const errorId = $derived(`${inputId}-error`);
const hintId = $derived(`${inputId}-hint`);
const hasError = $derived(Boolean(firstFieldError(field.state.meta.errors)));
const describedBy = $derived.by(() => {
	if (hasError) return errorId;
	if (hint) return hintId;
	return undefined;
});

const wrapperClass = fieldClass();
</script>

<div class={[wrapperClass, className]}>
	<Label for={inputId} class={fieldLabelClass(hasError)}
		><FieldContentView content={label} /></Label
	>
	<ChipDropdown
		id={inputId}
		multiple
		{searchable}
		showAllOption={false}
		allLabel={emptyLabel ?? placeholder}
		fullWidth
		align="start"
		aria-label={fieldContentText(label)}
		aria-describedby={describedBy}
		aria-invalid={hasError}
		{disabled}
		{options}
		{placeholder}
		value={field.state.value}
		onblur={field.handleBlur}
		onChange={field.handleChange}
	/>
	{#if hint && !hasError}
		<p id={hintId} class={FIELD_HINT_CLASS}>
			<FieldContentView content={hint} />
		</p>
	{/if}
	<FieldError id={errorId} errors={field.state.meta.errors} />
</div>
