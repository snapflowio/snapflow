<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ArrowRight from '@lucide/svelte/icons/arrow-right';
import Wallet from '@lucide/svelte/icons/wallet';
import {
	type PaymentWallet,
	type PaymentWalletPurpose,
	SanctionsStatus,
} from '@snapflow/api-client';
import { createMutation } from '@tanstack/svelte-query';
import { unlinkPaymentWalletMutationOptions } from '#lib/api/settlement/wallets.ts';
import PageSection from '#lib/components/detail/page-section.svelte';
import StatusBlock from '#lib/components/detail/status-block.svelte';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import AddressDisplay from '#lib/components/ui/address/address-display.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import {
	SANCTIONS_BADGES,
	sameAddress,
	shortAddress,
	WALLET_PURPOSES,
} from '#lib/features/wallet/lib/payment-wallet.ts';
import type { ConnectedWallet } from '#lib/features/wallet/state/connected-wallet.svelte.ts';
import type { UserWalletState } from '#lib/features/wallet/state/user-wallet.svelte.ts';
import { sentenceCase } from '#lib/utils/text.ts';
import { formatUsd } from '#lib/utils/usd.ts';
import PaymentWalletModal from './payment-wallet-modal.svelte';

interface PaymentWalletSectionProps {
	purpose: PaymentWalletPurpose;
	linked: PaymentWallet | undefined;
	wallet: UserWalletState;
	connected: ConnectedWallet;
	canManage: boolean;
	info?: string;
	escrowHeldMicroUsd?: string;
}

const EXTERNAL_OWNER = 'External wallet';

let {
	purpose,
	linked,
	wallet,
	connected,
	canManage,
	info,
	escrowHeldMicroUsd,
}: PaymentWalletSectionProps = $props();

const copy = $derived(WALLET_PURPOSES[purpose]);
const label = $derived(sentenceCase(copy.label));
const unlink = createMutation(() => unlinkPaymentWalletMutationOptions());
let changing = $state(false);
let confirmingUnlink = $state(false);

const heldInEscrow = $derived(
	escrowHeldMicroUsd !== undefined && BigInt(escrowHeldMicroUsd) > 0n
		? escrowHeldMicroUsd
		: null
);
const owner = $derived.by(() => {
	if (!linked) return null;
	if (sameAddress(wallet.address, linked.address)) return 'Snapflow wallet';
	return connected.controls(linked.address) ? 'Connected wallet' : null;
});
const screening = $derived(
	SANCTIONS_BADGES[linked?.sanctionsStatus ?? SanctionsStatus.Unchecked]
);

function confirmUnlink(event: SubmitEvent): void {
	event.preventDefault();
	unlink.mutate(purpose, {
		onSuccess: () => {
			confirmingUnlink = false;
		},
	});
}
</script>

<PageSection title="Linked wallet" {info}>
	{#snippet actions()}
		{#if canManage && linked}
			<Chip variant="ghost" onclick={() => (confirmingUnlink = true)}>
				Unlink
			</Chip>
			<Chip variant="secondary" onclick={() => (changing = true)}>
				Change wallet
			</Chip>
		{/if}
	{/snippet}
	{#if linked}
		<KeyValueList label={`${label} details`}>
			<KeyValueRow label="Address">
				<AddressDisplay value={linked.address} />
			</KeyValueRow>
			<KeyValueRow label="Owner" value={owner ?? EXTERNAL_OWNER} />
			<KeyValueRow label="Screening">
				<Badge size="sm" variant={screening.variant}>{screening.label}</Badge>
			</KeyValueRow>
		</KeyValueList>
	{:else}
		<StatusBlock icon={Wallet} tone="neutral" title={`No ${copy.label} linked`}>
			{#snippet actions()}
				{#if canManage}
					<Chip
						variant="primary"
						rightIcon={ArrowRight}
						onclick={() => (changing = true)}
					>
						Link wallet
					</Chip>
				{/if}
			{/snippet}
		</StatusBlock>
	{/if}
</PageSection>

{#if canManage}
	<PaymentWalletModal
		bind:open={changing}
		{purpose}
		{linked}
		{wallet}
		{connected}
		escrowHeldMicroUsd={heldInEscrow ?? undefined}
	/>
{/if}
<ChipModalConfirm
	bind:open={confirmingUnlink}
	title={`Unlink ${copy.label}`}
	text={linked
		? [
				{ text: shortAddress(linked.address), bold: true },
				` stops being your ${copy.label}. `,
				{ text: copy.unlinkWarning, error: true },
				heldInEscrow
					? ` It still has ${formatUsd(heldInEscrow)} in the escrow: withdraw it first.`
					: null,
			]
		: ''}
	pending={unlink.isPending}
	onsubmit={confirmUnlink}
>
	{#snippet confirm()}
		<Chip type="submit" variant="destructive" loading={unlink.isPending}>
			Unlink
		</Chip>
	{/snippet}
</ChipModalConfirm>
