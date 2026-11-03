<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { BillingOverviewDto } from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import {
	autoTopUpQueryOptions,
	billingConfigQueryOptions,
	confirmPaymentMutationOptions,
	paymentMethodsQueryOptions,
	pendingTopUpAction,
	recentTopUpsQueryOptions,
} from '#lib/api/billing/billing.ts';
import Credit from '#lib/components/icons/credit.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import BillingHeading from '#lib/features/billing/components/billing-heading.svelte';
import DailySpendChart from '#lib/features/billing/components/daily-spend-chart.svelte';
import PaymentMethodsSection from '#lib/features/billing/components/payment-methods-section.svelte';
import {
	billingOverviewNotice,
	hasActiveBurn,
} from '#lib/features/billing/lib/billing-overview.ts';
import {
	dailySpendPoints,
	hasDailySpend,
} from '#lib/features/billing/lib/daily-spend.ts';
import { formatDurationMinutes } from '#lib/features/billing/lib/format.ts';
import { getBillingActions } from '#lib/features/billing/state/billing-actions.svelte.ts';
import { getStripePromise } from '#lib/integrations/stripe/stripe.ts';
import { Path } from '#lib/routing/paths.ts';
import { formatCents, formatHourlyPrice, formatUsd } from '#lib/utils/usd.ts';
import { resolve } from '$app/paths';
import AutoTopUpSection from './auto-top-up-section.svelte';
import RecentTopUpsSection from './recent-top-ups-section.svelte';
import SpendLimitsSection from './spend-limits-section.svelte';
import SummaryRow from './summary-row.svelte';

interface BillingOverviewProps {
	overview: BillingOverviewDto;
}

let { overview }: BillingOverviewProps = $props();

const billing = getBillingActions();
const topUps = createQuery(() => recentTopUpsQueryOptions());
const methods = createQuery(() => paymentMethodsQueryOptions());
const policy = createQuery(() => autoTopUpQueryOptions());
const config = createQuery(() => billingConfigQueryOptions());
const pendingTopUp = $derived(pendingTopUpAction(topUps.data?.items));
const confirm = createMutation(() =>
	confirmPaymentMutationOptions(getStripePromise())
);
const status = $derived(billingOverviewNotice(overview));
const funding = $derived(overview.funding);
const month = $derived(overview.month);
const burning = $derived(hasActiveBurn(funding));
const hasSpend = $derived(
	hasDailySpend(dailySpendPoints(overview.daily, new Date(overview.observedAt)))
);
const balanceDetail = $derived(
	burning && funding.runwayMinutes !== undefined
		? `About ${formatDurationMinutes(funding.runwayMinutes)} left at current usage`
		: BigInt(funding.projectedAvailableMicroUsd) !==
				BigInt(funding.creditBalanceMicroUsd)
			? `${formatUsd(funding.projectedAvailableMicroUsd)} available after pending charges`
			: 'Credit balance'
);
let limitsOpen = $state(false);
</script>

{#if pendingTopUp}
	<Notice tone="warning">
		{#snippet title()}
			Your bank needs to confirm a payment
		{/snippet}
		{#snippet description()}
			{`An automatic top-up of ${formatCents(pendingTopUp.amountCents)} is waiting for card authentication. Automatic top-ups stay paused until it is confirmed.`}
		{/snippet}
		{#snippet action()}
			<Chip
				variant="primary"
				disabled={confirm.isPending}
				onclick={() => confirm.mutate(pendingTopUp.paymentIntentClientSecret)}
			>
				{confirm.isPending ? 'Authenticating...' : 'Authenticate'}
			</Chip>
		{/snippet}
	</Notice>
{/if}
{#if status}
	{#snippet statusAction()}
		{#if status.offersSpendControls}
			<Chip onclick={() => (limitsOpen = true)}>Spend limits</Chip>
		{:else}
			<Chip href={resolve(Path.BILLING_TOP_UP)}>Top up</Chip>
		{/if}
	{/snippet}
	<Notice
		tone={status.tone}
		action={billing.canManage ? statusAction : undefined}
	>
		{#snippet title()}
			{status.title}
		{/snippet}
		{#snippet description()}
			{status.description}
		{/snippet}
	</Notice>
{/if}

{#snippet topUpAction()}
	{#if billing.canManage}
		<Chip variant="border-shadow" href={resolve(Path.BILLING_TOP_UP)}>
			Top up
		</Chip>
	{/if}
{/snippet}

<BillingHeading
	icon={Credit}
	title={formatUsd(funding.creditBalanceMicroUsd)}
	detail={balanceDetail}
	trailing={topUpAction}
/>

{#snippet usageAction()}
	<Chip href={resolve(Path.BILLING_USAGE)}>View usage</Chip>
{/snippet}

<SettingsSection title="This month" action={usageAction}>
	<div class="flex flex-col gap-4">
		<SummaryRow
			label="Spent"
			value={formatUsd(month.actualMicroUsd)}
			detail={BigInt(month.forecastMicroUsd) > BigInt(month.actualMicroUsd)
				? `${formatUsd(month.forecastMicroUsd)} forecast`
				: undefined}
		/>
		{#if burning}
			<SummaryRow
				label="Current rate"
				value={formatHourlyPrice(funding.currentBurnMicroUsdPerHour)}
			/>
		{/if}
		{#if hasSpend}
			<DailySpendChart {overview} />
		{/if}
	</div>
</SettingsSection>

<SpendLimitsSection
	{overview}
	canManage={billing.canManage}
	bind:open={limitsOpen}
/>

{#if methods.isSuccess && policy.isSuccess && config.isSuccess}
	<AutoTopUpSection
		canManage={billing.canManage}
		config={config.data}
		methods={methods.data}
		policy={policy.data}
	/>
	<PaymentMethodsSection canManage={billing.canManage} methods={methods.data} />
{/if}

{#if topUps.isSuccess}
	<RecentTopUpsSection topUps={topUps.data.items} />
{/if}
