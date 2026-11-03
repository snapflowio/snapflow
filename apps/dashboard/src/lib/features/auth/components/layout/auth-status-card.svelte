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

export type AuthStatusAction = {
	label: string;
	disabled?: boolean;
	loading?: boolean;
	loadingLabel?: string;
} & (
	| { onSelect: () => void; href?: undefined }
	| { href: string; onSelect?: undefined }
);

interface AuthStatusCardProps {
	title: string;
	description: string | Snippet;
	loading?: boolean;
	details?: Snippet;
	actions?: readonly AuthStatusAction[];
}
</script>

<script lang="ts">
import Loader from '#lib/components/icons/loader.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import {
	AUTH_BUTTON_CLASS,
	AUTH_OUTLINE_BUTTON_CLASS,
} from '#lib/features/auth/lib/sign-in/auth-form-styles.ts';
import AuthHeader from './auth-header.svelte';

let {
	title,
	description,
	loading = false,
	details,
	actions = [],
}: AuthStatusCardProps = $props();
</script>

{#snippet actionLabel(
	action: AuthStatusAction
)}
	{#if action.loading}
		<span class="flex items-center gap-2">
			<Loader class="size-4" animate />
			{action.loadingLabel ?? `${action.label}…`}
		</span>
	{:else}
		{action.label}
	{/if}
{/snippet}

{#if loading}
	<AuthHeader title="Loading" {description} />
	<div class="mt-8 flex w-full items-center justify-center py-8">
		<Loader class="size-8 text-(--text-muted)" animate />
	</div>
{:else}
	<AuthHeader {title} {description} />
	<div class="mt-8 w-full space-y-3">
		{@render details?.()}
		{#each actions as action, index (action.label)}
			{const primary = $derived(index === 0)}
			{#if action.href !== undefined}
				<Chip
					href={action.href}
					variant={primary ? 'primary' : undefined}
					fullWidth
					class={primary ? AUTH_BUTTON_CLASS : AUTH_OUTLINE_BUTTON_CLASS}
				>
					{action.label}
				</Chip>
			{:else}
				<Chip
					variant={primary ? 'primary' : undefined}
					fullWidth
					disabled={action.disabled || action.loading}
					aria-busy={action.loading || undefined}
					onclick={action.onSelect}
					class={primary ? AUTH_BUTTON_CLASS : AUTH_OUTLINE_BUTTON_CLASS}
				>
					{@render actionLabel(action)}
				</Chip>
			{/if}
		{/each}
	</div>
{/if}
