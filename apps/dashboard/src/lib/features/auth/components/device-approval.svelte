<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { DeviceDecision } from '#lib/api/auth/device.ts';

const DECISION_RESULT: Record<
	DeviceDecision,
	{ title: string; description: string }
> = {
	approve: {
		title: 'Approved',
		description: 'Your terminal is finishing up — you can close this tab.',
	},
	deny: {
		title: 'Sign-in cancelled',
		description: 'You can close this tab and return to your terminal.',
	},
};
</script>

<script lang="ts">
import { createMutation, createQuery } from '@tanstack/svelte-query';
import {
	DEVICE_DECISION,
	DEVICE_PENDING_STATUS,
	deviceClaimQueryOptions,
	deviceDecisionMutationOptions,
} from '#lib/api/auth/device.ts';
import Loader from '#lib/components/icons/loader.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import Skeleton from '#lib/components/ui/skeleton.svelte';
import AuthFormMessage from '#lib/features/auth/components/layout/auth-form-message.svelte';
import AuthHeader from '#lib/features/auth/components/layout/auth-header.svelte';
import AuthNavPrompt from '#lib/features/auth/components/layout/auth-nav-prompt.svelte';
import AuthSubmitButton from '#lib/features/auth/components/sign-in/auth-submit-button.svelte';
import { authErrorMessage } from '#lib/features/auth/lib/auth-error-message.ts';
import { AUTH_OUTLINE_BUTTON_CLASS } from '#lib/features/auth/lib/sign-in/auth-form-styles.ts';
import { Path } from '#lib/routing/paths.ts';
import { resolve } from '$app/paths';

interface DeviceApprovalProps {
	userCode: string;
}

let { userCode }: DeviceApprovalProps = $props();

const claim = createQuery(() => deviceClaimQueryOptions(userCode));
const decide = createMutation(() =>
	deviceDecisionMutationOptions(() => userCode)
);

const device = $derived(claim.data);
const enterAnotherCodeHref = resolve(Path.DEVICE);
const approving = $derived(
	decide.isPending && decide.variables === DEVICE_DECISION.APPROVE
);
const denying = $derived(
	decide.isPending && decide.variables === DEVICE_DECISION.DENY
);
</script>

{#if claim.isError}
	<div class="space-y-6">
		<AuthHeader
			title="Invalid code"
			description="Check the code shown in your terminal and try again."
		/>
		<AuthFormMessage type="error" align="center">
			{authErrorMessage(claim.error)}
		</AuthFormMessage>
		<AuthNavPrompt href={enterAnotherCodeHref} linkLabel="Enter another code" />
	</div>
{:else if !device}
	<div class="flex w-full flex-col items-center" aria-busy="true">
		<Skeleton class="h-9.5 w-70 rounded-sm" />
		<Skeleton class="mt-1 h-5.75 w-90 rounded-sm" />
		<Skeleton class="h-5.75 w-60 rounded-sm" />
		<Skeleton class="mt-6 h-17.5 w-full rounded-[10px]" />
		<Skeleton class="mt-4 h-9 w-full rounded-[10px]" />
	</div>
{:else if decide.data}
	<AuthHeader
		title={DECISION_RESULT[decide.data].title}
		description={DECISION_RESULT[decide.data].description}
	/>
{:else if device.status !== DEVICE_PENDING_STATUS}
	<div class="space-y-6">
		<AuthHeader
			title="Code already used"
			description={`This code was already ${device.status}. Run the command again to get a new one.`}
		/>
		<AuthNavPrompt href={enterAnotherCodeHref} linkLabel="Enter another code" />
	</div>
{:else}
	<div class="space-y-6">
		<AuthHeader
			title="Connect your terminal"
			description="Approve only if the code below matches the one in your terminal."
		/>
		<div class="space-y-4">
			<div
				class="flex items-center justify-center rounded-[10px] border border-border py-5"
			>
				<code
					class="pl-[0.2em] font-mono text-(--text-primary) text-[28px] leading-none tracking-[0.2em]"
				>
					{device.user_code}
				</code>
			</div>
			<p class="text-(--text-muted) text-caption">
				Approving signs the Snapflow CLI in as you.
			</p>
			<AuthSubmitButton
				type="button"
				loading={approving || decide.isSuccess}
				loadingLabel="Approving"
				disabled={decide.isPending}
				onclick={() => decide.mutate(DEVICE_DECISION.APPROVE)}
			>
				Approve
			</AuthSubmitButton>
			<Chip
				fullWidth
				class={AUTH_OUTLINE_BUTTON_CLASS}
				disabled={decide.isPending}
				aria-busy={denying || undefined}
				onclick={() => decide.mutate(DEVICE_DECISION.DENY)}
			>
				{#if denying}
					<span class="flex items-center gap-2">
						<Loader class="size-4" animate />
						Denying
					</span>
				{:else}
					Deny
				{/if}
			</Chip>
			{#if decide.isError}
				<AuthFormMessage type="error" align="center">
					{authErrorMessage(decide.error)}
				</AuthFormMessage>
			{/if}
		</div>
	</div>
{/if}
