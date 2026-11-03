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
	PayoutOnboardingStatus,
	PayoutOnboardingStep,
	PayoutOnboardingStepId,
} from '#lib/features/billing/lib/payout-onboarding.ts';
import { Path } from '#lib/routing/paths.ts';

const STATUS_BADGES: Partial<Record<PayoutOnboardingStatus, 'red' | 'amber'>> =
	{
		action: 'red',
		waiting: 'amber',
	};

const STEP_ACTIONS: Record<
	PayoutOnboardingStepId,
	{
		label: string;
		to: typeof Path.EARNINGS_ACCOUNT | typeof Path.LISTINGS_MINE;
	}
> = {
	account: { label: 'Set up payouts', to: Path.EARNINGS_ACCOUNT },
	verify: { label: 'Continue with Stripe', to: Path.EARNINGS_ACCOUNT },
	bank: { label: 'Finish in Stripe', to: Path.EARNINGS_ACCOUNT },
	list: { label: 'Go to my listings', to: Path.LISTINGS_MINE },
};

function nextStep(
	steps: readonly PayoutOnboardingStep[]
): PayoutOnboardingStep | undefined {
	return steps.find(
		(step) => step.status === 'current' || step.status === 'action'
	);
}
</script>

<script lang="ts">
import Check from '@lucide/svelte/icons/check';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import {
	PAYOUT_ONBOARDING_STATUS_LABELS,
	PAYOUT_SETUP_PARAM,
} from '#lib/features/billing/lib/payout-onboarding.ts';
import type { PayoutOnboarding } from '#lib/features/billing/state/payout-onboarding.svelte.ts';
import { cn } from '#lib/utils/utils.ts';
import { resolve } from '$app/paths';

interface PayoutOnboardingChecklistProps {
	onboarding: PayoutOnboarding;
}

let { onboarding }: PayoutOnboardingChecklistProps = $props();

const next = $derived(nextStep(onboarding.steps));
const action = $derived.by(() => {
	if (!next || !onboarding.canManage) return null;
	const target = STEP_ACTIONS[next.id];
	const href = resolve(target.to);
	return {
		label: target.label,
		href: next.id === 'account' ? `${href}?${PAYOUT_SETUP_PARAM}` : href,
	};
});
const waiting = $derived(
	onboarding.steps.some((step) => step.status === 'waiting')
);
const footnote = $derived(
	!onboarding.canManage
		? 'A member who manages payouts can finish these steps.'
		: waiting
			? 'Stripe is reviewing the account. This usually takes a few minutes.'
			: null
);
</script>

{#snippet primaryAction()}
	{#if action}
		<Chip variant="primary" href={action.href}>{action.label}</Chip>
	{/if}
{/snippet}

<SettingsSection
	title="Get paid in four steps"
	action={action ? primaryAction : undefined}
>
	<ol class="space-y-2.5">
		{#each onboarding.steps as step, index (step.id)}
			{const badge = $derived(STATUS_BADGES[step.status])}
			<li class="flex gap-2.5">
				<span
					class={cn(
						'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs tabular-nums',
						step.status === 'done'
							? 'bg-(--badge-success-bg) text-(--badge-success-text)'
							: 'bg-surface-5 text-(--text-secondary)'
					)}
				>
					{#if step.status === 'done'}
						<Check class="size-3" aria-label="Done" />
					{:else}
						{index + 1}
					{/if}
				</span>
				<div class="flex min-w-0 flex-1 flex-col gap-0.5">
					<div class="flex min-w-0 flex-wrap items-center gap-2">
						<span
							class={cn(
								'text-sm leading-relaxed',
								step === next
									? 'text-(--text-primary)'
									: 'text-(--text-secondary)'
							)}
						>
							{step.title}
						</span>
						{#if badge}
							<Badge size="sm" variant={badge}>
								{PAYOUT_ONBOARDING_STATUS_LABELS[step.status]}
							</Badge>
						{/if}
					</div>
					<p class="text-(--text-muted) text-caption">{step.description}</p>
				</div>
			</li>
		{/each}
	</ol>
	{#if footnote}
		<p class="mt-3 pl-0.5 text-(--text-muted) text-caption">{footnote}</p>
	{/if}
</SettingsSection>
