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
import type { ChipOption } from '#lib/components/ui/chip/chip-selection.ts';
import type { FieldContent } from './field-content.svelte';

export interface SelectFieldProps {
	class?: ClassValue;
	disabled?: boolean;
	id?: string;
	label: FieldContent;
	options: readonly ChipOption[];
	placeholder?: string;
}
</script>

<script lang="ts">
import ChipDropdown from '#lib/components/ui/chip/chip-dropdown.svelte';
import Label from '#lib/components/ui/label.svelte';
import FieldContentView, { fieldContentText } from './field-content.svelte';
import FieldError from './field-error.svelte';
import { firstFieldError } from './field-errors.ts';
import { FIELD_LABEL_CLASS, fieldClass } from './field-layout.ts';
import { useFieldContext } from './form-context.ts';

let {
	class: className,
	disabled,
	id,
	label,
	options,
	placeholder,
}: SelectFieldProps = $props();

const field = useFieldContext<string>();
const fallbackId = $props.id();
const inputId = $derived(id ?? fallbackId);
const errorId = $derived(`${inputId}-error`);
const hasError = $derived(Boolean(firstFieldError(field.state.meta.errors)));

const wrapperClass = fieldClass();
</script>

<div class={[wrapperClass, className]}>
	<Label for={inputId} class={FIELD_LABEL_CLASS}
		><FieldContentView content={label} /></Label
	>
	<ChipDropdown
		id={inputId}
		fullWidth
		align="start"
		aria-label={fieldContentText(label)}
		aria-describedby={hasError ? errorId : undefined}
		aria-invalid={hasError}
		{disabled}
		{options}
		{placeholder}
		value={field.state.value}
		onblur={field.handleBlur}
		onChange={field.handleChange}
	/>
	<FieldError id={errorId} errors={field.state.meta.errors} />
</div>
