<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { EscrowSignerStatus, PaymentWalletPurpose } from '@snapflow/api-client';
import Well from '#lib/components/detail/well.svelte';
import FeedbackState from '#lib/components/feedback-state.svelte';
import PageColumn from '#lib/components/page/page-column.svelte';
import DailySpendChart from '#lib/features/billing/components/daily-spend-chart.svelte';
import AddFundsModal from '#lib/features/billing/components/funding/add-funds-modal.svelte';
import AutoTopUpModal from '#lib/features/billing/components/funding/auto-top-up-modal.svelte';
import DelegatedSignerModal from '#lib/features/billing/components/funding/delegated-signer-modal.svelte';
import SignerLimitModal from '#lib/features/billing/components/funding/signer-limit-modal.svelte';
import WithdrawModal from '#lib/features/billing/components/funding/withdraw-modal.svelte';
import FundingSetupChecklist from '#lib/features/billing/components/funding-setup-checklist.svelte';
import { signerReplaceable } from '#lib/features/billing/lib/billing-overview.ts';
import {
	dailySpendPoints,
	hasDailySpend,
} from '#lib/features/billing/lib/daily-spend.ts';
import { escrowDepositedMicroUsd } from '#lib/features/billing/lib/escrow-balance.ts';
import { getBillingActions } from '#lib/features/billing/state/billing-actions.svelte.ts';
import { BillingFunding } from '#lib/features/billing/state/billing-funding.svelte.ts';
import { BillingDialogs } from '#lib/features/billing/state/funding-dialog-request.svelte.ts';
import PaymentWalletModal from '#lib/features/wallet/components/payment-wallet-modal.svelte';
import WalletFeeConfirmModal from '#lib/features/wallet/components/wallet-fee-confirm-modal.svelte';
import { FundingDialog } from '#lib/routing/funding-dialog.ts';
import BalanceWell from './balance-well.svelte';
import FundingWalletWell from './funding-wallet-well.svelte';
import MonthSpendWell from './month-spend-well.svelte';
import PaymentsSection from './payments-section.svelte';
import PendingEscrowList from './pending-escrow-list.svelte';
import RecentActivitySection from './recent-activity-section.svelte';
import SpendLimitsModal from './spend-limits-modal.svelte';

const billing = getBillingActions();
const funding = new BillingFunding(() => billing.canManage);
const grant = $derived(funding.delegation.data?.delegatedSigner ?? null);
const signerActive = $derived(grant?.status === EscrowSignerStatus.Active);
const authorizing = $derived(grant === null || signerReplaceable(grant.status));
const dialogs = new BillingDialogs(ready);
const showsChart = $derived(
	funding.overview.data
		? hasDailySpend(
				dailySpendPoints(
					funding.overview.data.daily,
					new Date(funding.overview.data.observedAt)
				)
			)
		: false
);
const pendingDeposits = $derived(
	funding.pending.rows.some((row) => row.kind === 'deposit')
);
const escrowHeld = $derived(
	funding.account.data
		? escrowDepositedMicroUsd(funding.account.data)
		: undefined
);

function ready(dialog: FundingDialog): boolean {
	if (!funding.canManage) return false;
	switch (dialog) {
		case FundingDialog.Deposit:
			return funding.account.isSuccess && funding.wallets.isSuccess;
		case FundingDialog.Withdraw:
			return funding.account.isSuccess;
		case FundingDialog.FundingWallet:
			return funding.wallets.isSuccess;
		case FundingDialog.AutomaticPayments:
			return funding.signing && funding.delegation.isSuccess;
		case FundingDialog.SignerLimit:
			return funding.signing && signerActive;
		case FundingDialog.AutoTopUp:
			return funding.signing && funding.autoTopUp.isSuccess;
		case FundingDialog.SpendLimits:
			return funding.budget.isSuccess;
	}
}

function openState(dialog: FundingDialog): boolean {
	return dialogs.isOpen(dialog);
}

function setOpenState(dialog: FundingDialog): (open: boolean) => void {
	return (open) => dialogs.setOpen(dialog, open);
}

function setSignerLimitOpen(open: boolean): void {
	dialogs.setOpen(FundingDialog.AutomaticPayments, open);
	dialogs.setOpen(FundingDialog.SignerLimit, open);
}
</script>

<PageColumn title="Billing">
	{#if funding.account.isError}
		<FeedbackState
			variant="inline"
			tone="error"
			resource="your balance"
			error={funding.account.error}
			retrying={funding.account.isFetching}
			onRetry={() => void funding.account.refetch()}
		/>
	{:else if funding.account.isSuccess &&
		!funding.setupComplete &&
		funding.steps}
		<FundingSetupChecklist
			steps={funding.steps}
			canManage={funding.canManage}
			onAction={dialogs.show}
		/>
	{:else}
		<div class="@container/wells">
			<div
				class="grid gap-8 @min-[44rem]/wells:grid-cols-2 @min-[69rem]/wells:grid-cols-3 @min-[44rem]/wells:[&>:first-child]:col-span-2 @min-[69rem]/wells:[&>:first-child]:col-span-1"
			>
				{#if funding.account.isSuccess}
					<BalanceWell
						account={funding.account.data}
						canManage={funding.canManage}
						hasPendingDeposits={pendingDeposits}
						onAddFunds={() => dialogs.show(FundingDialog.Deposit)}
						onWithdraw={() => dialogs.show(FundingDialog.Withdraw)}
					/>
				{:else}
					<Well title="Available balance" loading />
				{/if}
				<MonthSpendWell
					overview={funding.overview.data}
					canManage={funding.canManage}
					onEditLimit={() => dialogs.show(FundingDialog.SpendLimits)}
				/>
				<FundingWalletWell
					{funding}
					onManage={() => dialogs.show(FundingDialog.FundingWallet)}
				/>
			</div>
		</div>
	{/if}

	{#if funding.account.isSuccess}
		<PendingEscrowList
			account={funding.account.data}
			rows={funding.pending.rows}
			delayed={funding.pending.delayed}
			source={funding.source}
			canManage={funding.canManage}
		/>
	{/if}

	{#if funding.overview.isError}
		<FeedbackState
			variant="inline"
			tone="error"
			resource="this month's spend"
			error={funding.overview.error}
			retrying={funding.overview.isFetching}
			onRetry={() => void funding.overview.refetch()}
		/>
	{:else if funding.overview.isSuccess && showsChart}
		<DailySpendChart overview={funding.overview.data} />
	{/if}

	<PaymentsSection {funding} {dialogs} />
	<RecentActivitySection />
</PageColumn>

{#if funding.canManage}
	{#if funding.account.data}
		<AddFundsModal
			bind:open={
				() => openState(FundingDialog.Deposit),
				setOpenState(FundingDialog.Deposit)
			}
			{funding}
		/>
		<WithdrawModal
			bind:open={
				() => openState(FundingDialog.Withdraw),
				setOpenState(FundingDialog.Withdraw)
			}
			account={funding.account.data}
			source={funding.source}
		/>
	{/if}
	<PaymentWalletModal
		bind:open={
			() => openState(FundingDialog.FundingWallet),
			setOpenState(FundingDialog.FundingWallet)
		}
		purpose={PaymentWalletPurpose.Funding}
		linked={funding.fundingWallet}
		wallet={funding.wallet}
		connected={funding.connected}
		escrowHeldMicroUsd={escrowHeld}
	/>
	{#if funding.budget.data}
		<SpendLimitsModal
			bind:open={
				() => openState(FundingDialog.SpendLimits),
				setOpenState(FundingDialog.SpendLimits)
			}
			budget={funding.budget.data}
		/>
	{/if}
	{#if funding.signing}
		{#if funding.autoTopUp.data}
			<AutoTopUpModal
				bind:open={
					() => openState(FundingDialog.AutoTopUp),
					setOpenState(FundingDialog.AutoTopUp)
				}
				current={funding.autoTopUp.data}
				minimumDeposit={funding.minimumDeposit}
				source={funding.source}
			/>
		{/if}
		{#if funding.delegation.data}
			{const delegation = $derived(funding.delegation.data)}
			{#if authorizing}
				<DelegatedSignerModal
					bind:open={
						() => openState(FundingDialog.AutomaticPayments),
						setOpenState(FundingDialog.AutomaticPayments)
					}
					{delegation}
					source={funding.source}
					replacing={grant !== null}
				/>
			{:else if grant && signerActive}
				<SignerLimitModal
					bind:open={
						() =>
							openState(FundingDialog.AutomaticPayments) ||
							openState(FundingDialog.SignerLimit),
						setSignerLimitOpen
					}
					{grant}
					windows={delegation.windows}
					hourlySpendMicroUsd={delegation.hourlySpendMicroUsd}
					source={funding.source}
				/>
			{/if}
		{/if}
	{/if}
{/if}

<WalletFeeConfirmModal
	confirmation={funding.wallet.feeConfirmation}
	contracts={funding.wallet.settlement}
/>
