<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type {
	ChipSize,
	ChipVariant,
} from '#lib/components/ui/chip/chip.svelte';
import type { HeaderActionKind } from './header-actions.ts';

const KIND_VARIANT = {
	secondary: 'secondary',
	discard: 'ghost',
	delete: 'destructive',
	primary: 'primary',
} as const satisfies Record<HeaderActionKind, ChipVariant>;
</script>

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
	size?: ChipSize;
	class?: ClassValue;
}

let {
	actions = [],
	leading,
	size = 'default',
	class: className,
}: HeaderActionClusterProps = $props();

const ordered = $derived(orderHeaderActions(actions));
</script>

{#snippet actionChip(action: HeaderAction, extra: Record<string, unknown>)}
	{const variant = $derived(KIND_VARIANT[action.kind ?? 'secondary'])}
	{const disabledReason = $derived(
		action.disabled ? action.disabledReason : undefined
	)}
	{#if action.href !== undefined}
		<Chip
			{...extra}
			{size}
			href={action.href}
			{variant}
			active={action.active}
			leftIcon={action.icon}
			mobileIconOnly={action.mobileIconOnly}
			target={action.external ? '_blank' : undefined}
			rel={action.external ? 'noopener noreferrer' : undefined}
			{disabledReason}
			aria-disabled={action.disabled || undefined}
		>
			{action.label}
		</Chip>
	{:else}
		<Chip
			{...extra}
			{size}
			type={action.type ?? 'button'}
			form={action.form}
			{variant}
			active={action.active}
			aria-pressed={action.active}
			leftIcon={action.icon}
			mobileIconOnly={action.mobileIconOnly}
			loading={action.pending}
			disabled={action.disabled}
			{disabledReason}
			onclick={action.type === 'submit' ? undefined : action.onSelect}
		>
			{action.label}
		</Chip>
	{/if}
{/snippet}

{#if leading || ordered.length > 0}
	<div class={cn(HEADER_ACTION_CLUSTER_CLASS, 'gap-2', className)}>
		{@render leading?.()}
		{#each ordered as action (action.id)}
			{#if action.tooltip && !(action.disabled && action.disabledReason)}
				<Tooltip content={action.tooltip}>
					{#snippet child({ props })}
						{@render actionChip(action, props)}
					{/snippet}
				</Tooltip>
			{:else}
				{@render actionChip(action, {})}
			{/if}
		{/each}
	</div>
{/if}
