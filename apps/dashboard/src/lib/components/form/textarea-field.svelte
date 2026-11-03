<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { HTMLTextareaAttributes } from 'svelte/elements';
import type { FieldContent } from './field-content.svelte';

type NativeTextareaProps = Omit<
	HTMLTextareaAttributes,
	'children' | 'name' | 'onblur' | 'onchange' | 'oninput' | 'value'
>;

interface TextareaFieldProps extends NativeTextareaProps {
	label: FieldContent;
	monospace?: boolean;
}
</script>

<script lang="ts">
import ChipTextarea from '#lib/components/ui/chip/chip-textarea.svelte';
import Label from '#lib/components/ui/label.svelte';
import FieldContentView from './field-content.svelte';
import FieldError from './field-error.svelte';
import { firstFieldError } from './field-errors.ts';
import { FIELD_LABEL_CLASS, fieldClass } from './field-layout.ts';
import { useFieldContext } from './form-context.ts';

let {
	class: className,
	id,
	label,
	monospace = false,
	...textareaProps
}: TextareaFieldProps = $props();

const field = useFieldContext<string>();
const fallbackId = $props.id();
const textareaId = $derived(id ?? fallbackId);
const errorId = $derived(`${textareaId}-error`);
const hasError = $derived(Boolean(firstFieldError(field.state.meta.errors)));

const wrapperClass = fieldClass();
</script>

<div class={wrapperClass}>
	<Label for={textareaId} class={FIELD_LABEL_CLASS}
		><FieldContentView content={label} /></Label
	>
	<ChipTextarea
		error={hasError}
		{...textareaProps}
		bind:value={() => field.state.value, field.handleChange}
		id={textareaId}
		name={field.name}
		onblur={field.handleBlur}
		aria-invalid={hasError || undefined}
		aria-describedby={hasError ? errorId : textareaProps['aria-describedby']}
		class={[monospace && 'font-mono', className]}
	/>
	<FieldError id={errorId} errors={field.state.meta.errors} />
</div>
