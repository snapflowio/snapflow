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
import { billingConfigQueryOptions } from '#lib/api/billing/billing.ts';
import FeedbackState from '#lib/components/feedback-state.svelte';
import QueryFeedbackState from '#lib/components/query-feedback-state.svelte';
import SettingsPage from '#lib/components/settings/settings-page.svelte';
import TopUpFlow from '#lib/features/billing/components/top-up/top-up-flow.svelte';
import { getBillingActions } from '#lib/features/billing/state/billing-actions.svelte.ts';
import { Path } from '#lib/routing/paths.ts';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

const billing = getBillingActions();
const config = createQuery(() => ({
	...billingConfigQueryOptions(),
	enabled: billing.canManage,
}));
function done(): void {
	void goto(resolve(Path.BILLING));
}
</script>

<svelte:head>
	<title>Top up · Billing · Snapflow</title>
</svelte:head>

<SettingsPage
	title="Top up"
	description="Prepaid credit pays for sandboxes and network usage."
	back={{ label: 'Billing', href: resolve(Path.BILLING) }}
>
	{#if !billing.canManage}
		<FeedbackState message="Ask a member who manages billing to add credit." />
	{:else if config.isSuccess}
		<TopUpFlow config={config.data} onDone={done} />
	{:else}
		<QueryFeedbackState
			query={config}
			loadingMessage="Loading top-up options..."
			errorMessage="Top-up options could not be loaded."
		/>
	{/if}
</SettingsPage>
