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
import type { ClassValue, HTMLInputAttributes } from 'svelte/elements';
import type { FieldContent } from './field-content.svelte';

type NativeInputProps = Omit<
	HTMLInputAttributes,
	| 'children'
	| 'class'
	| 'name'
	| 'onblur'
	| 'onchange'
	| 'oninput'
	| 'size'
	| 'value'
>;

interface TextFieldProps extends NativeInputProps {
	class?: ClassValue;
	startAdornment?: Snippet;
	endAdornment?: Snippet;
	inputRef?: HTMLInputElement | null;
	hint?: FieldContent;
	label: FieldContent;
	labelExtra?: Snippet;
	monospace?: boolean;
	secret?: boolean;
}
</script>

<script lang="ts">
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import Label from '#lib/components/ui/label.svelte';
import SecretInput from '#lib/components/ui/secret-input.svelte';
import FieldContentView from './field-content.svelte';
import FieldError from './field-error.svelte';
import { firstFieldError } from './field-errors.ts';
import { FIELD_LABEL_CLASS, fieldClass } from './field-layout.ts';
import { useFieldContext } from './form-context.ts';

let {
	class: className,
	startAdornment,
	endAdornment,
	hint,
	id,
	inputRef = $bindable(null),
	label,
	labelExtra,
	monospace = false,
	secret = false,
	type,
	...inputProps
}: TextFieldProps = $props();

const field = useFieldContext<string>();
const fallbackId = $props.id();
const inputId = $derived(id ?? fallbackId);
const errorId = $derived(`${inputId}-error`);
const hintId = $derived(`${inputId}-hint`);
const hasError = $derived(Boolean(firstFieldError(field.state.meta.errors)));
const describedBy = $derived(
	hasError ? errorId : hint ? hintId : inputProps['aria-describedby']
);
const controlClass = $derived(monospace ? 'font-mono' : undefined);

const wrapperClass = fieldClass();
</script>

<div class={[wrapperClass, className]}>
	<div class="flex items-center justify-between gap-3">
		<Label for={inputId} class={FIELD_LABEL_CLASS}
			><FieldContentView content={label} /></Label
		>
		{@render labelExtra?.()}
	</div>
	{#if secret && type !== 'password'}
		<SecretInput
			{...inputProps}
			bind:ref={inputRef}
			id={inputId}
			name={field.name}
			value={field.state.value}
			onblur={field.handleBlur}
			onChange={field.handleChange}
			aria-invalid={hasError || undefined}
			aria-describedby={describedBy}
			class={controlClass}
		/>
	{:else}
		<ChipInput
			{...inputProps}
			bind:ref={inputRef}
			id={inputId}
			name={field.name}
			{type}
			value={field.state.value}
			onblur={field.handleBlur}
			oninput={(event) => field.handleChange(event.currentTarget.value)}
			aria-invalid={hasError || undefined}
			aria-describedby={describedBy}
			error={hasError}
			{startAdornment}
			{endAdornment}
			class={controlClass}
		/>
	{/if}
	{#if hint && !hasError}
		<p id={hintId} class="text-(--text-muted) text-caption">
			<FieldContentView content={hint} />
		</p>
	{/if}
	<FieldError id={errorId} errors={field.state.meta.errors} />
</div>
