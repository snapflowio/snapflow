<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { Snippet } from 'svelte';
import type { ClassValue } from 'svelte/elements';
import {
	FIELD_ERROR_CLASS,
	FIELD_HINT_CLASS,
	fieldClass,
	fieldLabelClass,
} from '#lib/components/form/field-layout.ts';
import Label from '#lib/components/ui/label.svelte';
import { cn } from '#lib/utils/utils.ts';

interface ChipModalFieldProps {
	label?: string;
	for?: string;
	required?: boolean;
	hint?: string;
	error?: string | null;
	errorId?: string;
	hintId?: string;
	flush?: boolean;
	labelAccessory?: Snippet;
	children: Snippet;
	class?: ClassValue;
}

let {
	label,
	for: controlId,
	required = false,
	hint,
	error: errorText,
	errorId,
	hintId,
	flush = false,
	labelAccessory,
	children,
	class: className,
}: ChipModalFieldProps = $props();
</script>

<div class={cn(fieldClass(), flush && 'px-0', className)}>
	{#if label}
		<div class="flex flex-wrap items-center justify-between gap-2">
			<Label for={controlId} class={fieldLabelClass(Boolean(errorText))}>
				{label}
				{#if required}
					<span class="sr-only">(required)</span>
				{/if}
			</Label>
			{@render labelAccessory?.()}
		</div>
	{/if}
	{@render children()}
	{#if errorText}
		<p id={errorId} role="alert" class={FIELD_ERROR_CLASS}>
			{errorText}
		</p>
	{:else if hint}
		<p id={hintId} class={FIELD_HINT_CLASS}>{hint}</p>
	{/if}
</div>
