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

<div class={cn('flex flex-col gap-2.25', flush ? 'px-0' : 'px-2', className)}>
	{#if label}
		<div class="flex flex-wrap items-center justify-between gap-2">
			<Label for={controlId} class="pl-0.5 text-(--text-muted)">
				{label}
				{#if required}
					<span aria-hidden="true" class="ml-0.5 text-(--text-error)">*</span>
				{/if}
			</Label>
			{@render labelAccessory?.()}
		</div>
	{/if}
	{@render children()}
	{#if errorText}
		<p id={errorId} role="alert" class="text-(--text-error) text-caption">
			{errorText}
		</p>
	{:else if hint}
		<p id={hintId} class="text-(--text-muted) text-caption">{hint}</p>
	{/if}
</div>
