<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const MILLISECONDS_PER_MINUTE = 60_000;
</script>

<script lang="ts">
import type { EscrowAccount } from '@snapflow/api-client';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipInputPrefix from '#lib/components/ui/chip/chip-input-prefix.svelte';
import SummaryRow from '#lib/features/billing/components/overview/summary-row.svelte';
import { formatDurationMinutes } from '#lib/features/billing/lib/format.ts';
import { shortAddress } from '#lib/features/billing/lib/payment-wallet.ts';
import { EscrowWithdrawal } from '#lib/features/billing/state/escrow-withdrawal.svelte.ts';
import type { WalletConnection } from '#lib/features/billing/state/wallet.svelte.ts';
import { formatDateTime } from '#lib/utils/format.ts';
import { formatUsd } from '#lib/utils/usd.ts';

interface EscrowWithdrawalSectionProps {
	account: EscrowAccount;
	connection: WalletConnection;
}

let { account, connection }: EscrowWithdrawalSectionProps = $props();

const amountId = $props.id();
const messageId = `${amountId}-message`;
const withdrawal = new EscrowWithdrawal(() => account);
const signer = $derived(
	connection.controls(account.fundingWalletAddress) ? connection.escrow : null
);
const signerHint = $derived(
	account.fundingWalletAddress && !signer
		? `Connect ${shortAddress(account.fundingWalletAddress)} on ${connection.networkName} to withdraw.`
		: null
);
const countdown = $derived(
	withdrawal.remainingMilliseconds === null
		? null
		: formatDurationMinutes(
				String(
					Math.ceil(withdrawal.remainingMilliseconds / MILLISECONDS_PER_MINUTE)
				)
			)
);

function submit(event: SubmitEvent): void {
	event.preventDefault();
	if (signer) withdrawal.submitRequest(signer);
}
</script>

{#snippet dollarPrefix()}
	<ChipInputPrefix>$</ChipInputPrefix>
{/snippet}

<SettingsSection
	title="Withdraw"
	description="Withdrawals wait out a dispute window so running sandboxes can still be paid, then go back to the funding wallet."
>
	{#if withdrawal.pending}
		<div class="flex flex-col gap-4">
			<SummaryRow
				label="Pending withdrawal"
				value={formatUsd(account.pendingWithdrawalMicroUsd)}
				detail={account.withdrawalReadyAt
					? withdrawal.withdrawable
						? 'Ready to withdraw'
						: `Ready ${formatDateTime(account.withdrawalReadyAt)} · in ${countdown}`
					: undefined}
			/>
			<div class="flex flex-wrap items-center gap-2">
				<Chip
					variant="primary"
					disabled={!(signer && withdrawal.withdrawable) || withdrawal.busy}
					onclick={() => signer && withdrawal.complete.mutate(signer)}
				>
					{withdrawal.complete.isPending ? 'Withdrawing...' : 'Withdraw'}
				</Chip>
				<Chip
					disabled={!signer || withdrawal.busy}
					onclick={() => signer && withdrawal.cancel.mutate(signer)}
				>
					{withdrawal.cancel.isPending ? 'Cancelling...' : 'Cancel withdrawal'}
				</Chip>
			</div>
			{#if signerHint}
				<p class="text-(--text-muted) text-caption">{signerHint}</p>
			{/if}
		</div>
	{:else}
		<form class="flex flex-col gap-2.25" onsubmit={submit}>
			<fieldset
				class="flex flex-col gap-2 md:flex-row md:items-center"
				disabled={!signer || withdrawal.busy}
			>
				<ChipInput
					id={amountId}
					class="md:w-40 md:shrink-0"
					inputmode="decimal"
					placeholder="Amount"
					aria-label="Withdrawal amount in USDC"
					aria-describedby={messageId}
					bind:value={withdrawal.amount}
					error={withdrawal.error !== null}
					startAdornment={dollarPrefix}
				/>
				<Chip
					type="submit"
					disabled={withdrawal.units === null || withdrawal.error !== null}
				>
					{withdrawal.request.isPending
						? 'Requesting...'
						: 'Request withdrawal'}
				</Chip>
			</fieldset>
			{#if withdrawal.error}
				<p id={messageId} role="alert" class="text-(--text-error) text-caption">
					{withdrawal.error}
				</p>
			{:else}
				<p id={messageId} class="text-(--text-muted) text-caption">
					{signerHint ??
						`${formatUsd(account.balanceMicroUsd)} can be withdrawn.`}
				</p>
			{/if}
		</form>
	{/if}
</SettingsSection>
