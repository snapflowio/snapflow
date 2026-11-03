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
import Chip from '#lib/components/ui/chip/chip.svelte';
import { HEADER_ACTION_CLUSTER_CLASS } from '#lib/components/ui/chip/chip-chrome.ts';
import Tooltip from '#lib/components/ui/tooltip/tooltip.svelte';
import { cn } from '#lib/utils/utils.ts';
import { type HeaderAction, orderHeaderActions } from './header-actions.ts';

interface HeaderActionClusterProps {
	actions?: readonly HeaderAction[];
	leading?: Snippet;
	class?: ClassValue;
}

let {
	actions = [],
	leading,
	class: className,
}: HeaderActionClusterProps = $props();

const ordered = $derived(orderHeaderActions(actions));
</script>

{#snippet actionChip(
	action: HeaderAction
)}
	{const variant = $derived(action.kind === 'primary' ? 'primary' : undefined)}
	{const label = $derived(
		action.pending && action.pendingLabel ? action.pendingLabel : action.label
	)}
	{#if action.href !== undefined}
		<Chip
			href={action.href}
			{variant}
			active={action.active}
			leftIcon={action.icon}
			mobileIconOnly={action.mobileIconOnly}
			target={action.external ? '_blank' : undefined}
			rel={action.external ? 'noopener noreferrer' : undefined}
			aria-disabled={action.disabled || undefined}
		>
			{label}
		</Chip>
	{:else}
		<Chip
			type={action.type ?? 'button'}
			form={action.form}
			{variant}
			active={action.active}
			aria-pressed={action.active}
			leftIcon={action.icon}
			mobileIconOnly={action.mobileIconOnly}
			disabled={action.disabled}
			aria-busy={action.pending || undefined}
			onclick={action.type === 'submit' ? undefined : action.onSelect}
		>
			{label}
		</Chip>
	{/if}
{/snippet}

{#if leading || ordered.length > 0}
	<div class={cn(HEADER_ACTION_CLUSTER_CLASS, className)}>
		{@render leading?.()}
		{#each ordered as action (action.id)}
			{#if action.disabled && action.disabledReason}
				<Tooltip content={action.disabledReason}>
					{#snippet child({
						props,
					})}
						<span {...props} class="inline-flex cursor-not-allowed">
							{@render actionChip(action)}
						</span>
					{/snippet}
				</Tooltip>
			{:else}
				{@render actionChip(action)}
			{/if}
		{/each}
	</div>
{/if}
