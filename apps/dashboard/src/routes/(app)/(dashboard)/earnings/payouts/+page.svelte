<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Landmark from '@lucide/svelte/icons/landmark';
import { PaymentWalletPurpose } from '@snapflow/api-client';
import { createQuery } from '@tanstack/svelte-query';
import { paymentWalletsQueryOptions } from '#lib/api/settlement/wallets.ts';
import PageColumn from '#lib/components/page/page-column.svelte';
import QueryFeedbackState from '#lib/components/query-feedback-state.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import BillingHeading from '#lib/features/billing/components/billing-heading.svelte';
import EarningsHeader from '#lib/features/billing/components/earnings-header.svelte';
import PaymentWalletSection from '#lib/features/billing/components/wallet/payment-wallet-section.svelte';
import WalletGate from '#lib/features/billing/components/wallet/wallet-gate.svelte';
import {
	linkedWallet,
	PAYOUT_READINESS,
} from '#lib/features/billing/lib/payment-wallet.ts';
import { Wallet } from '#lib/features/billing/state/wallet.svelte.ts';
import { payoutReadiness } from '#lib/features/listings/lib/payout-readiness.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';

const permission = getOrganizationPermission();
const canManage = $derived(permission.can({ payouts: ['manage'] }));
const wallets = createQuery(() => paymentWalletsQueryOptions());
const wallet = new Wallet();
const payoutWallet = $derived(
	linkedWallet(wallets.data, PaymentWalletPurpose.Payout)
);
</script>

<svelte:head>
	<title>Payout wallet · Earnings · Snapflow</title>
</svelte:head>

<EarningsHeader />
{#if wallets.isSuccess}
	{const copy = $derived(PAYOUT_READINESS[payoutReadiness(wallets.data)])}
	{#snippet readinessBadge()}
		<Badge dot size="sm" variant={copy.badge.variant}>{copy.badge.label}</Badge>
	{/snippet}
	<PageColumn>
		<BillingHeading
			icon={Landmark}
			title={copy.title}
			detail={copy.description}
			trailing={readinessBadge}
		/>
		<WalletGate {wallet}>
			{#snippet children(
				connection
			)}
				<PaymentWalletSection
					purpose={PaymentWalletPurpose.Payout}
					linked={payoutWallet}
					{connection}
					{canManage}
					description="Claims pay your machines' earnings to this wallet in USDC. It must pass sanctions screening before your listings accept rentals."
				/>
			{/snippet}
		</WalletGate>
	</PageColumn>
{:else}
	<QueryFeedbackState
		query={wallets}
		loadingMessage="Loading the payout wallet..."
		errorMessage="The payout wallet could not be loaded."
	/>
{/if}
