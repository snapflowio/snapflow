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
import QueryFeedbackState from '#lib/components/query-feedback-state.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import {
	ESCROW_FROZEN_BADGE,
	linkedWallet,
	SANCTIONS_BADGES,
	shortAddress,
} from '#lib/features/billing/lib/payment-wallet.ts';
import { Path } from '#lib/routing/paths.ts';
import { formatDateTime } from '#lib/utils/format.ts';
import { formatUsd } from '#lib/utils/usd.ts';
import { resolve } from '$app/paths';
import SummaryRow from './summary-row.svelte';

interface EscrowSectionProps {
	available: string;
	canManage: boolean;
}

let { available, canManage }: EscrowSectionProps = $props();

const escrow = createQuery(() => escrowAccountQueryOptions());
const wallets = createQuery(() => paymentWalletsQueryOptions());
const delegation = createQuery(() => voucherDelegationQueryOptions());
const fundingWallet = $derived(
	linkedWallet(wallets.data, PaymentWalletPurpose.Funding)
);
</script>

{#snippet manageAction()}
	{#if canManage}
		<Chip href={resolve(Path.BILLING_FUNDING)}>Manage</Chip>
	{/if}
{/snippet}

<SettingsSection title="Escrow" action={manageAction}>
	{#if escrow.isSuccess && wallets.isSuccess}
		{const account = $derived(escrow.data)}
		<div class="flex flex-col gap-4">
			<SummaryRow label="Funding wallet">
				<span class="flex min-w-0 items-center gap-2">
					{#if fundingWallet}
						{const badge = $derived(
							account.blocked
								? ESCROW_FROZEN_BADGE
								: SANCTIONS_BADGES[fundingWallet.sanctionsStatus]
						)}
						<Badge size="sm" variant={badge.variant}>{badge.label}</Badge>
						<span class="truncate text-(--text-muted) text-small tabular-nums">
							{shortAddress(fundingWallet.address)}
						</span>
					{:else}
						<span class="text-(--text-muted) text-small">Not linked</span>
					{/if}
				</span>
			</SummaryRow>
			<SummaryRow
				label="Held in escrow"
				value={formatUsd(account.balanceMicroUsd)}
			/>
			{#if BigInt(account.pendingWithdrawalMicroUsd) > 0n}
				<SummaryRow
					label="Pending withdrawal"
					value={formatUsd(account.pendingWithdrawalMicroUsd)}
					detail={account.withdrawalReadyAt
						? `ready ${formatDateTime(account.withdrawalReadyAt)}`
						: undefined}
				/>
			{/if}
			<SummaryRow label="Available to spend" value={formatUsd(available)} />
			{#if delegation.isSuccess}
				<SummaryRow
					label="Payment authorization"
					value={delegation.data.sessionKey
						? `Up to ${formatUsd(delegation.data.sessionKey.spendCapMicroUsd)}`
						: 'Not authorized'}
					detail={delegation.data.sessionKey
						? `until ${formatDateTime(delegation.data.sessionKey.expiresAt)}`
						: undefined}
				/>
			{/if}
		</div>
	{:else}
		<QueryFeedbackState
			class="py-4"
			query={escrow.isError ? escrow : wallets}
			loadingMessage="Loading the escrow account..."
			errorMessage="The escrow account could not be loaded."
		/>
	{/if}
</SettingsSection>
