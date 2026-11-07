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
import { voucherDelegationQueryOptions } from '#lib/api/settlement/channels.ts';
import { escrowAccountQueryOptions } from '#lib/api/settlement/escrow.ts';
import { paymentWalletsQueryOptions } from '#lib/api/settlement/wallets.ts';
import FeedbackState from '#lib/components/feedback-state.svelte';
import QueryFeedbackState from '#lib/components/query-feedback-state.svelte';
import SettingsPage from '#lib/components/settings/settings-page.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import EscrowDepositSection from '#lib/features/billing/components/funding/escrow-deposit-section.svelte';
import EscrowWithdrawalSection from '#lib/features/billing/components/funding/escrow-withdrawal-section.svelte';
import PaymentAuthorizationSection from '#lib/features/billing/components/payments/payment-authorization-section.svelte';
import PaymentWalletSection from '#lib/features/billing/components/wallet/payment-wallet-section.svelte';
import WalletGate from '#lib/features/billing/components/wallet/wallet-gate.svelte';
import { linkedWallet } from '#lib/features/billing/lib/payment-wallet.ts';
import { getBillingActions } from '#lib/features/billing/state/billing-actions.svelte.ts';
import { Wallet } from '#lib/features/billing/state/wallet.svelte.ts';
import { Path } from '#lib/routing/paths.ts';
import { resolve } from '$app/paths';

const billing = getBillingActions();
const wallets = createQuery(() => ({
	...paymentWalletsQueryOptions(),
	enabled: billing.canManage,
}));
const account = createQuery(() => ({
	...escrowAccountQueryOptions(),
	enabled: billing.canManage,
}));
const delegation = createQuery(() => ({
	...voucherDelegationQueryOptions(),
	enabled: billing.canManage,
}));
const wallet = new Wallet();
const fundingWallet = $derived(
	linkedWallet(wallets.data, PaymentWalletPurpose.Funding)
);
</script>

<svelte:head>
	<title>Funding · Billing · Snapflow</title>
</svelte:head>

<SettingsPage
	title="Funding"
	description="USDC in the Snapflow escrow pays for sandboxes and network usage. You keep custody: only your funding wallet can withdraw it or authorize payments from it."
	back={{ label: 'Billing', href: resolve(Path.BILLING) }}
>
	{#if !billing.canManage}
		<FeedbackState
			message="Ask a member who manages billing to fund the escrow."
		/>
	{:else if !wallets.isSuccess}
		<QueryFeedbackState
			query={wallets}
			loadingMessage="Loading wallets..."
			errorMessage="Wallets could not be loaded."
		/>
	{:else if !account.isSuccess}
		<QueryFeedbackState
			query={account}
			loadingMessage="Loading the escrow account..."
			errorMessage="The escrow account could not be loaded."
		/>
	{:else}
		{#if account.data.blocked}
			<Notice tone="error">
				{#snippet title()}
					The escrow froze this funding wallet
				{/snippet}
				{#snippet description()}
					Deposits, payments and withdrawals from it are blocked. Contact
					support if you think this is a mistake.
				{/snippet}
			</Notice>
		{/if}
		<WalletGate {wallet}>
			{#snippet children(
				connection
			)}
				<PaymentWalletSection
					purpose={PaymentWalletPurpose.Funding}
					linked={fundingWallet}
					{connection}
					canManage={billing.canManage}
					description="The wallet that funds the escrow and authorizes payments for your sandboxes."
				/>
				<EscrowDepositSection {connection} {fundingWallet} />
				{#if fundingWallet}
					<EscrowWithdrawalSection account={account.data} {connection} />
					{#if delegation.isSuccess}
						<PaymentAuthorizationSection
							delegation={delegation.data}
							{connection}
							canManage={billing.canManage}
						/>
					{:else}
						<QueryFeedbackState
							query={delegation}
							loadingMessage="Loading the payment authorization..."
							errorMessage="The payment authorization could not be loaded."
						/>
					{/if}
				{/if}
			{/snippet}
		</WalletGate>
	{/if}
</SettingsPage>
