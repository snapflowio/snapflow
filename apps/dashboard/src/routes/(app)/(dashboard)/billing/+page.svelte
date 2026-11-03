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
import { billingOverviewQueryOptions } from '#lib/api/billing/billing.ts';
import PageColumn from '#lib/components/page/page-column.svelte';
import QueryFeedbackState from '#lib/components/query-feedback-state.svelte';
import BillingHeader from '#lib/features/billing/components/billing-header.svelte';
import BillingOverview from '#lib/features/billing/components/overview/billing-overview.svelte';
import { settleReturnedTopUp } from '#lib/features/billing/state/top-up-return.svelte.ts';

const query = createQuery(() => billingOverviewQueryOptions());
settleReturnedTopUp();
</script>

<svelte:head>
	<title>Billing · Snapflow</title>
</svelte:head>

<BillingHeader />
{#if query.isSuccess}
	<PageColumn>
		<BillingOverview overview={query.data} />
	</PageColumn>
{:else}
	<QueryFeedbackState
		{query}
		loadingMessage="Loading billing overview..."
		errorMessage="Billing overview could not be loaded."
	/>
{/if}
