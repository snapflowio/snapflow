<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const FUNDING_WALLET_INFO =
	'Funds the escrow and sets the hourly limit for automatic payments. Only the funding wallet can withdraw what it deposits.';
</script>

<script lang="ts">
import { PaymentWalletPurpose, RecoveryStatus } from '@snapflow/api-client';
import { createQuery } from '@tanstack/svelte-query';
import { escrowAccountQueryOptions } from '#lib/api/settlement/escrow.ts';
import { paymentWalletsQueryOptions } from '#lib/api/settlement/wallets.ts';
import Well from '#lib/components/detail/well.svelte';
import FeedbackState from '#lib/components/feedback-state.svelte';
import PageColumn from '#lib/components/page/page-column.svelte';
import ResourceTabs from '#lib/components/resource/resource-tabs.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import Skeleton from '#lib/components/ui/skeleton/skeleton.svelte';
import {
	WalletTab,
	walletSearchSchema,
	walletTabHref,
	walletTabs,
} from '#lib/features/billing/lib/billing-wallet.ts';
import { escrowDepositedMicroUsd } from '#lib/features/billing/lib/escrow-balance.ts';
import { getBillingActions } from '#lib/features/billing/state/billing-actions.svelte.ts';
import CreateWalletState from '#lib/features/wallet/components/create-wallet-state.svelte';
import PaymentWalletSection from '#lib/features/wallet/components/payment-wallet-section.svelte';
import ReceiveUsdcModal from '#lib/features/wallet/components/receive-usdc-modal.svelte';
import RecoveryModal from '#lib/features/wallet/components/recovery-modal.svelte';
import RecoverySection from '#lib/features/wallet/components/recovery-section.svelte';
import SendUsdcModal from '#lib/features/wallet/components/send-usdc-modal.svelte';
import WalletActivitySection from '#lib/features/wallet/components/wallet-activity-section.svelte';
import WalletSummary from '#lib/features/wallet/components/wallet-summary.svelte';
import { linkedWallet } from '#lib/features/wallet/lib/payment-wallet.ts';
import { ConnectedWallet } from '#lib/features/wallet/state/connected-wallet.svelte.ts';
import { UserWalletState } from '#lib/features/wallet/state/user-wallet.svelte.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';

const billing = getBillingActions();
const params = new SearchParams(walletSearchSchema);
const tab = $derived(params.current.tab);
const tabs = $derived(walletTabs(tab));
const wallet = new UserWalletState();
const connected = new ConnectedWallet();
const paymentWallets = createQuery(() => paymentWalletsQueryOptions());
const escrow = createQuery(() => escrowAccountQueryOptions());
const fundingWallet = $derived(
	linkedWallet(paymentWallets.data, PaymentWalletPurpose.Funding)
);
const escrowHeld = $derived(
	escrow.data ? escrowDepositedMicroUsd(escrow.data) : undefined
);
let recoveryOpen = $state(false);
let receiveOpen = $state(false);
let sendOpen = $state(false);

function setUpRecovery(): void {
	sendOpen = false;
	recoveryOpen = true;
}
</script>

<PageColumn title="Wallet" width="settings">
	{#if wallet.query.isError}
		<FeedbackState
			tone="error"
			resource="your wallet"
			error={wallet.query.error}
			retrying={wallet.query.isFetching}
			onRetry={() => void wallet.query.refetch()}
		/>
	{:else if !wallet.query.isSuccess}
		<Well title="Balance" loading />
		<Skeleton class="h-40 rounded-2xl" />
	{:else if !wallet.wallet}
		<CreateWalletState {wallet} />
	{:else}
		{const account = $derived(wallet.wallet)}
		<ResourceTabs {tabs} label="Wallet views" />
		{#if tab === WalletTab.Overview}
			{#if account.recoveryStatus === RecoveryStatus.None}
				<Notice tone="warning" title="Recovery is not set up">
					{#snippet action()}
						<Chip
							variant="secondary"
							size="compact"
							href={walletTabHref(WalletTab.Recovery)}
						>
							Set up
						</Chip>
					{/snippet}
				</Notice>
			{/if}
			<WalletSummary
				{wallet}
				{account}
				onReceive={() => (receiveOpen = true)}
				onSend={() => (sendOpen = true)}
			/>
		{:else if tab === WalletTab.Funding}
			{#if paymentWallets.isSuccess}
				<PaymentWalletSection
					purpose={PaymentWalletPurpose.Funding}
					linked={fundingWallet}
					{wallet}
					{connected}
					canManage={billing.canManage}
					info={FUNDING_WALLET_INFO}
					escrowHeldMicroUsd={escrowHeld}
				/>
			{:else if paymentWallets.isError}
				<FeedbackState
					variant="inline"
					tone="error"
					resource="your funding wallet"
					error={paymentWallets.error}
					retrying={paymentWallets.isFetching}
					onRetry={() => void paymentWallets.refetch()}
				/>
			{:else}
				<Skeleton class="h-40 rounded-2xl" />
			{/if}
		{:else if tab === WalletTab.Recovery}
			<RecoverySection
				{wallet}
				{account}
				primary={!billing.canManage || fundingWallet !== undefined}
				onSetUp={setUpRecovery}
			/>
		{:else}
			<WalletActivitySection settlement={wallet.settlement} />
		{/if}
		<ReceiveUsdcModal
			bind:open={receiveOpen}
			{wallet}
			address={account.safeAddress}
		/>
		<SendUsdcModal
			bind:open={sendOpen}
			{wallet}
			onSetUpRecovery={setUpRecovery}
		/>
		<RecoveryModal bind:open={recoveryOpen} {wallet} {connected} />
	{/if}
</PageColumn>
