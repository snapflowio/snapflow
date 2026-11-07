<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { PaymentWalletPurpose } from '@snapflow/api-client';
import { createQuery } from '@tanstack/svelte-query';
import { paymentWalletsQueryOptions } from '#lib/api/settlement/wallets.ts';
import PageColumn from '#lib/components/page/page-column.svelte';
import QueryFeedbackState from '#lib/components/query-feedback-state.svelte';
import EarningsOverview from '#lib/features/billing/components/earnings/earnings-overview.svelte';
import EarningsHeader from '#lib/features/billing/components/earnings-header.svelte';
import { linkedWallet } from '#lib/features/billing/lib/payment-wallet.ts';
import { payoutReadiness } from '#lib/features/listings/lib/payout-readiness.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';

const permission = getOrganizationPermission();
const wallets = createQuery(() => paymentWalletsQueryOptions());
</script>

<svelte:head>
	<title>Earnings · Snapflow</title>
</svelte:head>

<EarningsHeader />
{#if wallets.isSuccess}
	<PageColumn>
		<EarningsOverview
			readiness={payoutReadiness(wallets.data)}
			payoutWallet={linkedWallet(wallets.data, PaymentWalletPurpose.Payout)}
			canManage={permission.can({ payouts: ['manage'] })}
		/>
	</PageColumn>
{:else}
	<QueryFeedbackState
		query={wallets}
		loadingMessage="Loading earnings..."
		errorMessage="Earnings could not be loaded."
	/>
{/if}
