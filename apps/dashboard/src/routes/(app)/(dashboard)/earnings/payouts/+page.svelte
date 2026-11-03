<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import EmptyState from '#lib/components/empty-state.svelte';
import QueryFeedbackState from '#lib/components/query-feedback-state.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import EarningsHeader from '#lib/features/billing/components/earnings-header.svelte';
import PayoutHistory from '#lib/features/billing/components/payouts/payout-history.svelte';
import { PAYOUT_SETUP_PARAM } from '#lib/features/billing/lib/payout-onboarding.ts';
import { PayoutOnboarding } from '#lib/features/billing/state/payout-onboarding.svelte.ts';
import { Path } from '#lib/routing/paths.ts';
import { resolve } from '$app/paths';

const onboarding = new PayoutOnboarding();
</script>

<svelte:head>
	<title>Payouts · Earnings · Snapflow</title>
</svelte:head>

<EarningsHeader />
{#if onboarding.account}
	<PayoutHistory />
{:else if onboarding.missing}
	<EmptyState
		title="No payout account"
		description="Set up payouts to receive what your machines earn."
	>
		{#snippet actions()}
			{#if onboarding.canManage}
				<Chip
					variant="primary"
					href={`${resolve(Path.EARNINGS_ACCOUNT)}?${PAYOUT_SETUP_PARAM}`}
				>
					Set up payouts
				</Chip>
			{/if}
		{/snippet}
	</EmptyState>
{:else}
	<QueryFeedbackState
		query={onboarding.query}
		loadingMessage="Loading the payout account..."
		errorMessage="The payout account could not be loaded."
	/>
{/if}
