<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const STAGE_LABELS = {
	approving: 'Approving USDC...',
	depositing: 'Depositing...',
} as const;
</script>

<script lang="ts">
import CreditCard from '@lucide/svelte/icons/credit-card';
import type { PaymentWallet } from '@snapflow/api-client';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipInputPrefix from '#lib/components/ui/chip/chip-input-prefix.svelte';
import { shortAddress } from '#lib/features/billing/lib/payment-wallet.ts';
import { EscrowDeposit } from '#lib/features/billing/state/escrow-deposit.svelte.ts';
import type { WalletConnection } from '#lib/features/billing/state/wallet.svelte.ts';

interface EscrowDepositSectionProps {
	connection: WalletConnection;
	fundingWallet: PaymentWallet | undefined;
}

let { connection, fundingWallet }: EscrowDepositSectionProps = $props();

const amountId = $props.id();
const messageId = `${amountId}-message`;
const deposit = new EscrowDeposit(
	() => connection.escrow,
	() => fundingWallet?.address ?? null
);
const description = $derived(
	fundingWallet
		? `USDC is held by the escrow for ${shortAddress(fundingWallet.address)} and only that wallet can withdraw it. Any connected wallet can deposit.`
		: 'Link a funding wallet first: deposits are credited to it.'
);

function submit(event: SubmitEvent): void {
	event.preventDefault();
	deposit.submit();
}
</script>

{#snippet dollarPrefix()}
	<ChipInputPrefix>$</ChipInputPrefix>
{/snippet}

{#snippet buyAction()}
	{#if connection.connected}
		<Chip leftIcon={CreditCard} onclick={connection.buyUsdc}>Buy USDC</Chip>
	{/if}
{/snippet}

<SettingsSection title="Deposit" {description} action={buyAction}>
	<form class="flex flex-col gap-2.25" onsubmit={submit}>
		<fieldset
			class="flex flex-col gap-2 md:flex-row md:items-center"
			disabled={!fundingWallet || deposit.mutation.isPending}
		>
			<ChipInput
				id={amountId}
				class="md:w-40 md:shrink-0"
				inputmode="decimal"
				placeholder="Amount"
				aria-label="Deposit amount in USDC"
				aria-describedby={messageId}
				bind:value={deposit.amount}
				error={deposit.error !== null}
				startAdornment={dollarPrefix}
			/>
			<Chip type="submit" variant="primary" disabled={!deposit.ready}>
				{deposit.stage ? STAGE_LABELS[deposit.stage] : 'Deposit'}
			</Chip>
		</fieldset>
		{#if deposit.error}
			<p id={messageId} role="alert" class="text-(--text-error) text-caption">
				{deposit.error}
			</p>
		{:else}
			<p id={messageId} class="text-(--text-muted) text-caption">
				{connection.escrow
					? deposit.hint
					: 'Connect a wallet on the settlement network to deposit.'}
			</p>
		{/if}
	</form>
</SettingsSection>
