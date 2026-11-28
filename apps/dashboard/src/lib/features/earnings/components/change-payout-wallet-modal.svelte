<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import Globe from '@lucide/svelte/icons/globe';
import KeyRound from '@lucide/svelte/icons/key-round';

const REVIEW_FACTS = [
	'Future payouts go to the new wallet.',
	'Earnings not paid out yet go to the new wallet.',
	'Listings keep taking rentals once the new wallet is screened.',
] as const;

const NOT_CREATED = 'Not created yet';
const NOT_CONNECTED = 'Not connected';
</script>

<script lang="ts">
import type { PaymentWallet } from '@snapflow/api-client';
import AddressDisplay from '#lib/components/ui/address/address-display.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipRadioCards, {
	type ChipRadioCard,
} from '#lib/components/ui/chip/chip-radio-cards.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalError from '#lib/components/ui/chip-modal/chip-modal-error.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import {
	PAYOUT_WALLET_STEPS,
	PayoutWalletChange,
	PayoutWalletSource,
	PayoutWalletStep,
} from '#lib/features/earnings/state/payout-wallet-change.svelte.ts';
import ConnectWalletMenu from '#lib/features/wallet/components/connect-wallet-menu.svelte';
import { shortAddress } from '#lib/features/wallet/lib/payment-wallet.ts';

interface ChangePayoutWalletModalProps {
	open: boolean;
	current: PaymentWallet | undefined;
	onClose: () => void;
	onUnlink?: () => void;
}

let { open, current, onClose, onUnlink }: ChangePayoutWalletModalProps =
	$props();

const change = new PayoutWalletChange(() => current);
const title = $derived(current ? 'Change payout wallet' : 'Set payout wallet');
const options = $derived<ChipRadioCard<PayoutWalletSource>[]>([
	{
		value: PayoutWalletSource.Snapflow,
		title: 'Snapflow wallet',
		meta: change.own.address ? shortAddress(change.own.address) : NOT_CREATED,
		icon: KeyRound,
	},
	{
		value: PayoutWalletSource.Browser,
		title: 'Browser wallet',
		meta: change.connected.address
			? `${change.connected.connectorName ?? 'Wallet'} · ${shortAddress(change.connected.address)}`
			: NOT_CONNECTED,
		icon: Globe,
	},
]);

function close(): void {
	if (change.pending) return;
	change.reset();
	onClose();
}

function unlink(): void {
	if (change.pending || !onUnlink) return;
	close();
	onUnlink();
}

function submit(): void {
	if (change.step === PayoutWalletStep.Choose) {
		change.review();
		return;
	}
	void change.confirm(close);
}
</script>

{#snippet unlinkAction()}
	<Chip variant="ghost" class="text-(--text-error)" onclick={unlink}>
		Unlink wallet
	</Chip>
{/snippet}

{#snippet addressBlock(label: string, address: string)}
	<div class="flex flex-col gap-1">
		<span class="text-(--text-muted) text-xs">{label}</span>
		<AddressDisplay value={address} form="full" />
	</div>
{/snippet}

{#snippet stepCaption()}
	<span class="mr-1 font-mono text-(--text-muted) text-xs tabular-nums">
		{`${change.stepNumber} of ${PAYOUT_WALLET_STEPS.length}`}
	</span>
{/snippet}

<ChipModal
	{open}
	onOpenChange={(next) => {
		if (!next) close();
	}}
	onsubmit={submit}
	dismissDisabled={change.pending}
	srTitle={title}
>
	<ChipModalHeader actions={stepCaption} onClose={close}>
		{title}
	</ChipModalHeader>
	<ChipModalBody>
		<ChipModalError message={change.error} />
		{#if change.step === PayoutWalletStep.Choose}
			{#if current}
				{@render addressBlock('Current', current.address)}
			{/if}
			<div class="flex flex-col gap-2">
				<ChipRadioCards
					label="New payout wallet"
					{options}
					bind:value={change.source}
				/>
				{#if change.source === PayoutWalletSource.Browser &&
					!change.connected.connected}
					<div class="flex items-center justify-between gap-3">
						<span class="text-(--text-muted) text-xs">
							Connect the wallet you want to be paid in.
						</span>
						<ConnectWalletMenu connected={change.connected} />
					</div>
				{:else if change.wrongChain}
					<div class="flex items-center justify-between gap-3">
						<span role="alert" class="text-(--text-error) text-xs">
							{`Switch to ${change.connected.networkName} first`}
						</span>
						<Chip size="compact" onclick={() => void change.switchNetwork()}>
							Switch network
						</Chip>
					</div>
				{:else if change.chooseError && change.candidate}
					<span role="alert" class="text-(--text-error) text-xs">
						{change.chooseError}
					</span>
				{/if}
			</div>
		{:else if change.candidate}
			<div class="flex flex-col gap-4">
				{#if current}
					{@render addressBlock('From', current.address)}
				{/if}
				{@render addressBlock('To', change.candidate)}
			</div>
			{#if change.lookalike}
				<Notice
					tone="error"
					title={`This address looks like ${shortAddress(change.lookalike)} but is different. Check every character.`}
				/>
			{/if}
			<ul class="flex flex-col gap-1.5">
				{#each REVIEW_FACTS as fact (fact)}
					<li class="text-(--text-body) text-sm">{fact}</li>
				{/each}
			</ul>
		{/if}
	</ChipModalBody>
	{#if change.step === PayoutWalletStep.Choose}
		<ChipModalFooter
			onCancel={close}
			leadingContent={current && onUnlink ? unlinkAction : undefined}
		>
			{#snippet primaryAction(initialFocus)}
				<Chip
					type="submit"
					variant="primary"
					disabled={!change.canContinue}
					{@attach initialFocus}
				>
					Continue
				</Chip>
			{/snippet}
		</ChipModalFooter>
	{:else}
		<ChipModalFooter
			onCancel={change.back}
			cancelLabel="Back"
			cancelDisabled={change.pending}
		>
			{#snippet primaryAction(initialFocus)}
				<Chip
					type="submit"
					variant="primary"
					loading={change.pending}
					{@attach initialFocus}
				>
					{title}
				</Chip>
			{/snippet}
		</ChipModalFooter>
	{/if}
</ChipModal>
