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
import type { ChipVariant } from '#lib/components/ui/chip/chip.svelte';

export type AuthStatusActionTone = 'primary' | 'secondary';

export type AuthStatusAction = {
	label: string;
	tone?: AuthStatusActionTone;
	disabled?: boolean;
	loading?: boolean;
} & (
	| { onSelect: () => void; href?: undefined }
	| { href: string; onSelect?: undefined }
);

interface AuthStatusCardProps {
	title: string;
	description?: string;
	loading?: boolean;
	details?: Snippet;
	actions?: readonly AuthStatusAction[];
}

const TONE_VARIANT = {
	primary: 'primary',
	secondary: 'ghost',
} as const satisfies Record<AuthStatusActionTone, ChipVariant>;

function actionTone(
	action: AuthStatusAction,
	index: number
): AuthStatusActionTone {
	return action.tone ?? (index === 0 ? 'primary' : 'secondary');
}
</script>

<script lang="ts">
import Chip from '#lib/components/ui/chip/chip.svelte';
import Spinner from '#lib/components/ui/spinner.svelte';
import { AUTH_BUTTON_CLASS } from '#lib/features/auth/lib/sign-in/auth-form-styles.ts';
import AuthHeader from './auth-header.svelte';

let {
	title,
	description,
	loading = false,
	details,
	actions = [],
}: AuthStatusCardProps = $props();
</script>

<AuthHeader {title} {description} />
{#if loading}
	<div
		role="status"
		aria-label="Loading"
		class="flex w-full items-center justify-center py-8"
	>
		<Spinner class="size-6 text-(--text-muted)" />
	</div>
{:else}
	<div class="flex w-full flex-col gap-y-3">
		{@render details?.()}
		{#each actions as action, index (action.label)}
			{const tone = $derived(actionTone(action, index))}
			{#if action.href !== undefined}
				<Chip
					href={action.href}
					variant={TONE_VARIANT[tone]}
					fullWidth
					class={AUTH_BUTTON_CLASS}
				>
					{action.label}
				</Chip>
			{:else}
				<Chip
					variant={TONE_VARIANT[tone]}
					fullWidth
					disabled={action.disabled}
					loading={action.loading}
					onclick={action.onSelect}
					class={AUTH_BUTTON_CLASS}
				>
					{action.label}
				</Chip>
			{/if}
		{/each}
	</div>
{/if}
