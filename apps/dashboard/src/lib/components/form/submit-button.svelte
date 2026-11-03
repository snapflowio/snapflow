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
import Chip, { type ChipProps } from '#lib/components/ui/chip/chip.svelte';
import { useFormContext } from './form-context.ts';

interface SubmitButtonProps extends Omit<ChipProps, 'children' | 'type'> {
	children: Snippet;
	pendingLabel?: string;
}

let {
	children: label,
	disabled = false,
	pendingLabel,
	variant = 'primary',
	...rest
}: SubmitButtonProps = $props();

const form = useFormContext();
</script>

<form.Subscribe
	selector={(state) => [state.canSubmit, state.isSubmitting] as const}
>
	{#snippet children([canSubmit, isSubmitting])}
		<Chip
			{...rest}
			type="submit"
			{variant}
			disabled={disabled || !canSubmit || isSubmitting}
			aria-busy={isSubmitting || undefined}
		>
			{#if isSubmitting && pendingLabel}
				{pendingLabel}
			{:else}
				{@render label()}
			{/if}
		</Chip>
	{/snippet}
</form.Subscribe>
