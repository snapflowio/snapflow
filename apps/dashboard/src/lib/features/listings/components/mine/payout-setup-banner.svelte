<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { PayoutOnboardingStepId } from '#lib/features/billing/lib/payout-onboarding.ts';

const STEP_ACTION_LABELS: Partial<Record<PayoutOnboardingStepId, string>> = {
	account: 'Set up payouts',
	verify: 'Continue with Stripe',
	bank: 'Finish in Stripe',
};
</script>

<script lang="ts">
import Chip from '#lib/components/ui/chip/chip.svelte';
import type { PayoutOnboarding } from '#lib/features/billing/state/payout-onboarding.svelte.ts';
import { Path } from '#lib/routing/paths.ts';
import { resolve } from '$app/paths';

interface PayoutSetupBannerProps {
	onboarding: PayoutOnboarding;
}

let { onboarding }: PayoutSetupBannerProps = $props();

const stepIndex = $derived(
	onboarding.steps.findIndex((step) => step.status !== 'done')
);
const step = $derived(onboarding.steps[stepIndex]);
const actionLabel = $derived(
	onboarding.canManage && step ? STEP_ACTION_LABELS[step.id] : undefined
);
const detail = $derived.by(() => {
	if (!onboarding.canManage) {
		return 'A member who manages payouts can finish setup.';
	}
	if (step?.status === 'waiting') {
		return 'Stripe is reviewing the account.';
	}
	return step
		? `Step ${stepIndex + 1} of ${onboarding.steps.length}: ${step.title}`
		: null;
});
</script>

<div role="status" class="shrink-0 bg-surface-active px-4 py-2.5 md:px-6">
	<div class="flex items-center justify-between gap-3">
		<p class="min-w-0 text-small">
			Set up payouts to list machines publicly.
			{#if detail}
				<span class="text-(--text-muted)">{detail}</span>
			{/if}
		</p>
		{#if actionLabel}
			<Chip
				class="h-7 shrink-0 px-2 text-caption"
				href={resolve(Path.EARNINGS_ACCOUNT)}
			>
				{actionLabel}
			</Chip>
		{/if}
	</div>
</div>
