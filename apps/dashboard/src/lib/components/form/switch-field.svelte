<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { ClassValue } from 'svelte/elements';
import Label from '#lib/components/ui/label.svelte';
import Switch from '#lib/components/ui/switch.svelte';
import type { FieldContent } from './field-content.svelte';
import FieldContentView from './field-content.svelte';
import FieldError from './field-error.svelte';
import { firstFieldError } from './field-errors.ts';
import { fieldClass } from './field-layout.ts';
import { useFieldContext } from './form-context.ts';

interface SwitchFieldProps {
	class?: ClassValue;
	description?: FieldContent;
	disabled?: boolean;
	id?: string;
	label: FieldContent;
}

let {
	class: className,
	description,
	disabled,
	id,
	label,
}: SwitchFieldProps = $props();

const field = useFieldContext<boolean>();
const fallbackId = $props.id();
const inputId = $derived(id ?? fallbackId);
const errorId = $derived(`${inputId}-error`);
const descriptionId = $derived(`${inputId}-description`);
const hasError = $derived(Boolean(firstFieldError(field.state.meta.errors)));

const wrapperClass = fieldClass();
</script>

<div class={[wrapperClass, className]}>
	<div class="flex items-center justify-between gap-4">
		<div class="flex min-w-0 flex-col gap-1">
			<Label for={inputId}><FieldContentView content={label} /></Label>
			{#if description}
				<p id={descriptionId} class="text-(--text-muted) text-caption">
					<FieldContentView content={description} />
				</p>
			{/if}
		</div>
		<Switch
			id={inputId}
			name={field.name}
			checked={field.state.value}
			{disabled}
			onblur={field.handleBlur}
			onCheckedChange={field.handleChange}
			aria-describedby={hasError
				? errorId
				: description
					? descriptionId
					: undefined}
			aria-invalid={hasError || undefined}
		/>
	</div>
	<FieldError id={errorId} errors={field.state.meta.errors} />
</div>
