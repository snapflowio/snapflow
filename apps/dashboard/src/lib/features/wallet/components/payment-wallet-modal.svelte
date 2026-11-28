<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { ChipRadioCard } from '#lib/components/ui/chip/chip-radio-cards.svelte';

const WalletChoice = { Own: 'own', Connected: 'connected' } as const;
type WalletChoice = (typeof WalletChoice)[keyof typeof WalletChoice];

const WALLET_UNREACHABLE = 'Could not reach the wallet';
const NO_OWN_WALLET_REASON = 'Create your Snapflow wallet first';
const CURRENT_LABEL = 'Current';
</script>

<script lang="ts">
import type { PaymentWallet, PaymentWalletPurpose } from '@snapflow/api-client';
import { createMutation } from '@tanstack/svelte-query';
import { watch } from 'runed';
import { userErrorMessage } from '#lib/api/errors/api-error-details.ts';
import {
	linkOwnPaymentWalletMutationOptions,
	linkPaymentWalletMutationOptions,
} from '#lib/api/settlement/wallets.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipRadioCards from '#lib/components/ui/chip/chip-radio-cards.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalError from '#lib/components/ui/chip-modal/chip-modal-error.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import ConnectWalletMenu from '#lib/features/wallet/components/connect-wallet-menu.svelte';
import {
	sameAddress,
	shortAddress,
	WALLET_PURPOSES,
} from '#lib/features/wallet/lib/payment-wallet.ts';
import type { ConnectedWallet } from '#lib/features/wallet/state/connected-wallet.svelte.ts';
import type { UserWalletState } from '#lib/features/wallet/state/user-wallet.svelte.ts';
import { walletFailure } from '#lib/integrations/wallet/wallet-error.ts';
import { titleCase } from '#lib/utils/text.ts';
import { formatUsd } from '#lib/utils/usd.ts';

interface PaymentWalletModalProps {
	open?: boolean;
	purpose: PaymentWalletPurpose;
	linked: PaymentWallet | undefined;
	wallet: UserWalletState;
	connected: ConnectedWallet;
	escrowHeldMicroUsd?: string;
}

let {
	open = $bindable(false),
	purpose,
	linked,
	wallet,
	connected,
	escrowHeldMicroUsd,
}: PaymentWalletModalProps = $props();

const copy = $derived(WALLET_PURPOSES[purpose]);
const linkOwn = createMutation(() => linkOwnPaymentWalletMutationOptions());
const link = createMutation(() => linkPaymentWalletMutationOptions());
const linking = $derived(linkOwn.isPending || link.isPending);
let choice = $state<WalletChoice>(WalletChoice.Own);
let failure = $state<string | null>(null);

const ownIsLinked = $derived(sameAddress(wallet.address, linked?.address));
const connectedIsLinked = $derived(connected.controls(linked?.address));
const chosenIsLinked = $derived(
	choice === WalletChoice.Own ? ownIsLinked : connectedIsLinked
);
const heldInEscrow = $derived(
	escrowHeldMicroUsd !== undefined && BigInt(escrowHeldMicroUsd) > 0n
		? escrowHeldMicroUsd
		: null
);
const options = $derived<ChipRadioCard<WalletChoice>[]>([
	{
		value: WalletChoice.Own,
		title: 'Snapflow wallet',
		meta: wallet.address
			? `${shortAddress(wallet.address)}${ownIsLinked ? ` · ${CURRENT_LABEL}` : ''}`
			: undefined,
		disabledReason: wallet.address ? undefined : NO_OWN_WALLET_REASON,
	},
	{
		value: WalletChoice.Connected,
		title: 'Connected wallet',
		meta: connected.address
			? `${shortAddress(connected.address)}${connectedIsLinked ? ` · ${CURRENT_LABEL}` : ''}`
			: 'Connect a browser wallet and sign a message',
	},
]);
const replaceWarning = $derived.by(() => {
	if (!linked || chosenIsLinked) return null;
	const held = heldInEscrow
		? ` It still has ${formatUsd(heldInEscrow)} in the escrow, and only it can withdraw that.`
		: '';
	return `${shortAddress(linked.address)} stops being your ${copy.label}.${held}`;
});
const ready = $derived(
	!chosenIsLinked &&
		!linking &&
		(choice === WalletChoice.Own ? wallet.address !== null : connected.ready)
);
const submitLabel = $derived.by(() => {
	if (choice === WalletChoice.Own) return 'Use Snapflow wallet';
	return link.isPending ? 'Waiting for signature' : 'Link with signature';
});

watch(
	() => open,
	(isOpen) => {
		if (!isOpen) return;
		failure = null;
		choice =
			wallet.address && !connected.ready
				? WalletChoice.Own
				: WalletChoice.Connected;
	}
);

function close(): void {
	if (linking) return;
	open = false;
}

function done(): void {
	open = false;
}

function fail(error: Error): void {
	failure = userErrorMessage(error);
}

async function linkConnected(): Promise<void> {
	try {
		link.mutate(
			{ purpose, wallet: await connected.walletClient() },
			{ onSuccess: done, onError: fail }
		);
	} catch (error) {
		failure = walletFailure(WALLET_UNREACHABLE)(error) ?? null;
	}
}

function submit(event: SubmitEvent): void {
	event.preventDefault();
	if (!ready) return;
	failure = null;
	if (choice === WalletChoice.Own) {
		linkOwn.mutate(purpose, { onSuccess: done, onError: fail });
	} else {
		void linkConnected();
	}
}
</script>

<ChipModal
	bind:open
	srTitle={titleCase(copy.label)}
	dismissDisabled={linking}
	onsubmit={submit}
>
	<ChipModalHeader onClose={close} closeDisabled={linking}>
		{linked ? `Change ${copy.label}` : `Link a ${copy.label}`}
	</ChipModalHeader>
	<ChipModalBody>
		<ChipRadioCards
			label={titleCase(copy.label)}
			{options}
			bind:value={choice}
		/>
		{#if choice === WalletChoice.Connected}
			<div class="flex justify-end gap-1.5">
				<ConnectWalletMenu {connected} />
			</div>
		{/if}
		{#if replaceWarning}
			<p class="text-(--text-muted) text-sm">
				{replaceWarning}
				<span class="text-(--text-error)">{copy.unlinkWarning}</span>
			</p>
		{/if}
		<ChipModalError message={failure} />
	</ChipModalBody>
	<ChipModalFooter onCancel={close} cancelDisabled={linking}>
		{#snippet primaryAction()}
			<Chip type="submit" variant="primary" loading={linking} disabled={!ready}>
				{submitLabel}
			</Chip>
		{/snippet}
	</ChipModalFooter>
</ChipModal>
