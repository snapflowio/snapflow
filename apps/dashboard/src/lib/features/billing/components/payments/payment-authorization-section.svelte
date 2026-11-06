<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { VoucherDelegation } from '@snapflow/api-client';
import { createMutation } from '@tanstack/svelte-query';
import { getAddress } from 'viem';
import { ESCROW_QUERY_KEYS } from '#lib/api/settlement/escrow.ts';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import SummaryRow from '#lib/features/billing/components/overview/summary-row.svelte';
import {
	type EscrowWallet,
	revokeSessionKey,
} from '#lib/features/billing/lib/escrow-contract.ts';
import { shortAddress } from '#lib/features/billing/lib/payment-wallet.ts';
import type { WalletConnection } from '#lib/features/billing/state/wallet.svelte.ts';
import { formatDateTime } from '#lib/utils/format.ts';
import { formatHourlyPrice, formatUsd } from '#lib/utils/usd.ts';
import SessionKeyModal from './session-key-modal.svelte';

interface PaymentAuthorizationSectionProps {
	delegation: VoucherDelegation;
	connection: WalletConnection;
	canManage: boolean;
}

let { delegation, connection, canManage }: PaymentAuthorizationSectionProps =
	$props();

const sessionKey = $derived(delegation.sessionKey);
const signer = $derived(
	canManage && connection.controls(delegation.fundingWalletAddress)
		? connection.escrow
		: null
);
const underfunded = $derived(
	sessionKey !== null &&
		BigInt(sessionKey.hourlyCapMicroUsd) <
			BigInt(delegation.suggestedHourlyCapMicroUsd)
);
const signerHint = $derived(
	!canManage
		? 'Ask a member who manages billing to change the authorization.'
		: !signer && delegation.fundingWalletAddress
			? `Connect ${shortAddress(delegation.fundingWalletAddress)} on ${connection.networkName} to change the authorization.`
			: null
);
const revoke = createMutation(() => ({
	mutationFn: (wallet: EscrowWallet) =>
		revokeSessionKey(wallet, getAddress(delegation.signerAddress)),
	meta: {
		success:
			'Authorization revoked. Running sandboxes are held once their payments fall behind.',
		failure: 'The authorization could not be revoked',
		invalidates: ESCROW_QUERY_KEYS,
	},
}));
let authorizing = $state(false);
let confirmingRevoke = $state(false);

function confirmRevoke(event: SubmitEvent): void {
	event.preventDefault();
	if (!signer) return;
	revoke.mutate(signer, {
		onSuccess: () => {
			confirmingRevoke = false;
		},
	});
}
</script>

{#snippet status()}
	<Badge size="sm" variant={sessionKey ? 'green' : 'amber'}>
		{sessionKey ? 'Authorized' : 'Not authorized'}
	</Badge>
{/snippet}

{#snippet actions()}
	{#if signer}
		<Chip
			variant={sessionKey ? undefined : 'primary'}
			onclick={() => (authorizing = true)}
		>
			{sessionKey ? 'Change limits' : 'Authorize'}
		</Chip>
		{#if sessionKey}
			<Chip onclick={() => (confirmingRevoke = true)}>Revoke</Chip>
		{/if}
	{/if}
{/snippet}

<SettingsSection
	title="Payment authorization"
	description="Snapflow's signer pays hosts from your escrow with vouchers, only within the caps your funding wallet sets on chain. You can revoke it at any time."
	accessory={status}
	action={actions}
>
	<div class="flex flex-col gap-4">
		{#if underfunded}
			<Notice tone="warning">
				{#snippet title()}
					The hourly cap is below what running sandboxes need
				{/snippet}
				{#snippet description()}
					{`Running sandboxes need about ${formatHourlyPrice(delegation.suggestedHourlyCapMicroUsd)}. Raise the cap or they stop once payments fall behind.`}
				{/snippet}
			</Notice>
		{/if}
		<SummaryRow
			label="Delegated signer"
			value={shortAddress(delegation.signerAddress)}
			detail={delegation.signerAddress}
		/>
		{#if sessionKey}
			<SummaryRow
				label="Spend cap"
				value={formatUsd(sessionKey.spendCapMicroUsd)}
			/>
			<SummaryRow
				label="Hourly cap"
				value={formatHourlyPrice(sessionKey.hourlyCapMicroUsd)}
			/>
			<SummaryRow
				label="Active"
				value={`${formatDateTime(sessionKey.activatedAt)} to ${formatDateTime(sessionKey.expiresAt)}`}
			/>
		{/if}
		{#if signerHint}
			<p class="text-(--text-muted) text-caption">{signerHint}</p>
		{/if}
	</div>
</SettingsSection>
{#if signer}
	<SessionKeyModal bind:open={authorizing} {delegation} wallet={signer} />
{/if}
<ChipModalConfirm
	bind:open={confirmingRevoke}
	title="Revoke authorization"
	text={[
		'Snapflow can no longer sign vouchers from your escrow. ',
		{
			text: 'Running sandboxes are held once their payments fall behind.',
			error: true,
		},
	]}
	pending={revoke.isPending}
	onsubmit={confirmRevoke}
>
	{#snippet confirm()}
		<ChipModalAction
			type="submit"
			variant="destructive"
			disabled={revoke.isPending}
		>
			{revoke.isPending ? 'Revoking...' : 'Revoke'}
		</ChipModalAction>
	{/snippet}
</ChipModalConfirm>
