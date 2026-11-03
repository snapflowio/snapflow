<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { createQuery } from '@tanstack/svelte-query';
import { hostEarningsQueryOptions } from '#lib/api/billing/payouts.ts';
import PageColumn from '#lib/components/page/page-column.svelte';
import QueryFeedbackState from '#lib/components/query-feedback-state.svelte';
import EarningsOverview from '#lib/features/billing/components/earnings/earnings-overview.svelte';
import EarningsHeader from '#lib/features/billing/components/earnings-header.svelte';
import PayoutOnboardingChecklist from '#lib/features/billing/components/payouts/payout-onboarding-checklist.svelte';
import { PayoutOnboarding } from '#lib/features/billing/state/payout-onboarding.svelte.ts';

const query = createQuery(() => hostEarningsQueryOptions());
const onboarding = new PayoutOnboarding();
</script>

<svelte:head>
	<title>Earnings · Snapflow</title>
</svelte:head>

<EarningsHeader />
{#if query.isSuccess}
	<PageColumn>
		<EarningsOverview earnings={query.data} />
		{#if onboarding.resolved && !onboarding.ready}
			<PayoutOnboardingChecklist {onboarding} />
		{/if}
	</PageColumn>
{:else}
	<QueryFeedbackState
		{query}
		loadingMessage="Loading earnings..."
		errorMessage="Earnings could not be loaded."
	/>
{/if}
