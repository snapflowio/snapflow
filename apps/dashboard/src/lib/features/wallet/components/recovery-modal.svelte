<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { RecoveryStep } from '#lib/features/wallet/state/recovery-setup.svelte.ts';

const STEP_TITLES = {
	choose: 'Set up recovery',
	phrase: 'Write down your recovery phrase',
	confirm: 'Confirm your recovery phrase',
	owner: 'Choose the recovery owner',
	fee: 'Approve the network fee',
} as const satisfies Record<RecoveryStep, string>;
</script>

<script lang="ts">
import Plus from '@lucide/svelte/icons/plus';
import { RecoveryOwnerKind } from '@snapflow/api-client';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import LabeledCheckbox from '#lib/components/ui/checkbox/labeled-checkbox.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipSwitch from '#lib/components/ui/chip/chip-switch.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import { passkeyLabel } from '#lib/features/account/state/passkey-label.svelte.ts';
import ConnectWalletMenu from '#lib/features/wallet/components/connect-wallet-menu.svelte';
import WalletFeeReview from '#lib/features/wallet/components/wallet-fee-review.svelte';
import { shortAddress } from '#lib/features/wallet/lib/payment-wallet.ts';
import {
	RECOVERY_KIND_OPTIONS,
	RECOVERY_KINDS,
} from '#lib/features/wallet/lib/wallet-status.ts';
import type { ConnectedWallet } from '#lib/features/wallet/state/connected-wallet.svelte.ts';
import { RecoverySetup } from '#lib/features/wallet/state/recovery-setup.svelte.ts';
import type { UserWalletState } from '#lib/features/wallet/state/user-wallet.svelte.ts';

interface RecoveryModalProps {
	open?: boolean;
	wallet: UserWalletState;
	connected: ConnectedWallet;
}

let {
	open = $bindable(false),
	wallet,
	connected,
}: RecoveryModalProps = $props();

const fieldId = $props.id();
const setup = new RecoverySetup(
	() => wallet,
	() => connected
);
const title = $derived(STEP_TITLES[setup.step]);
const pending = $derived(setup.pending);
const passkeyOptions = $derived(
	setup.otherPasskeys.map((passkey) => ({
		value: passkey.id,
		label: passkeyLabel(passkey),
	}))
);

function close(): void {
	if (pending) return;
	open = false;
	setup.reset();
}

function submit(): void {
	if (setup.step === 'fee') {
		void setup.submit(() => {
			open = false;
		});
		return;
	}
	setup.next();
}
</script>

<ChipModal
	bind:open
	onOpenChange={(next) => {
		if (!next) setup.reset();
	}}
	onsubmit={submit}
	dismissDisabled={pending}
	srTitle={title}
>
	<ChipModalHeader onClose={close} closeDisabled={pending}
		>{title}</ChipModalHeader
	>
	<ChipModalBody>
		{#if setup.step === 'choose'}
			<ChipModalField label="Recovery owner">
				<ChipSwitch
					aria-label="Recovery owner"
					options={RECOVERY_KIND_OPTIONS}
					bind:value={setup.kind}
				/>
			</ChipModalField>
			<p class="text-(--text-muted) text-sm">
				{RECOVERY_KINDS[setup.kind].description}
			</p>
		{:else if setup.step === 'phrase'}
			<Notice tone="warning">
				{#snippet title()}
					Anyone with these words controls your wallet
				{/snippet}
				{#snippet info()}
					Write them down in order and keep them offline. Snapflow cannot show
					them again or recover them for you.
				{/snippet}
			</Notice>
			<ol class="grid grid-cols-2 gap-2 sm:grid-cols-3">
				{#each setup.words as word, index (index)}
					<li
						class="flex items-center gap-2 rounded-lg border border-border bg-surface-3 px-2 py-1.5 font-mono text-sm"
					>
						<span class="w-5 text-right text-(--text-muted) text-xs">
							{index + 1}
						</span>
						<span class="text-(--text-body)">{word}</span>
					</li>
				{/each}
			</ol>
			<div>
				<LabeledCheckbox bind:checked={setup.wroteDown}>
					I wrote down all {setup.words.length} words
				</LabeledCheckbox>
			</div>
		{:else if setup.step === 'confirm'}
			<p class="text-(--text-muted) text-sm">
				Enter these words from your phrase to show you have them.
			</p>
			{#each setup.confirmWords as word (word.index)}
				<ChipModalField
					label={`Word ${word.index + 1}`}
					for={`${fieldId}-word-${word.index}`}
				>
					<ChipInput
						id={`${fieldId}-word-${word.index}`}
						class="font-mono"
						autocomplete="off"
						autocapitalize="none"
						spellcheck={false}
						bind:value={setup.confirmInputs[word.position]}
						error={Boolean(setup.confirmInputs[word.position]?.trim()) &&
							!word.matches}
					/>
				</ChipModalField>
			{/each}
		{:else if setup.step === 'fee'}
			{#if setup.prepared}
				<WalletFeeReview feeMicroUsd={setup.prepared.transaction.feeMicroUsd}>
					<KeyValueRow
						align="end"
						label="Recovery owner"
						value={RECOVERY_KINDS[setup.prepared.owner.kind].label}
					/>
				</WalletFeeReview>
			{/if}
		{:else if setup.kind === RecoveryOwnerKind.Passkey}
			<ChipModalField
				label="Passkey"
				hint="Use a passkey on another device, so losing one device does not lock you out."
			>
				{#if passkeyOptions.length > 0}
					<ChipSwitch
						aria-label="Recovery passkey"
						options={passkeyOptions}
						value={setup.passkeyId ?? ''}
						onChange={(value) => (setup.passkeyId = value)}
					/>
				{:else}
					<p class="text-(--text-muted) text-xs">
						You have no other passkey yet.
					</p>
				{/if}
			</ChipModalField>
			<div>
				<Chip
					leftIcon={Plus}
					disabled={setup.addPasskey.isPending}
					onclick={setup.addRecoveryPasskey}
				>
					{setup.addPasskey.isPending
						? 'Waiting for passkey...'
						: 'Add a passkey'}
				</Chip>
			</div>
		{:else}
			<ChipModalField
				label="Wallet"
				hint="The connected wallet's address becomes the recovery owner. Keep access to it."
			>
				<div class="flex flex-wrap items-center gap-2">
					<span class="font-mono text-(--text-body) text-sm">
						{connected.address
							? shortAddress(connected.address)
							: 'No wallet connected'}
					</span>
					<ConnectWalletMenu {connected} />
				</div>
			</ChipModalField>
		{/if}
	</ChipModalBody>
	<ChipModalFooter onCancel={close} cancelDisabled={pending}>
		{#snippet primaryAdjacentAction()}
			{#if setup.step !== 'choose'}
				<Chip disabled={pending} onclick={setup.back}>Back</Chip>
			{/if}
		{/snippet}
		{#snippet primaryAction()}
			<Chip
				type="submit"
				variant="primary"
				loading={setup.preparation.isPending || setup.mutation.isPending}
				disabled={!setup.canContinue}
			>
				{setup.step === 'fee' ? 'Approve and add owner' : 'Continue'}
			</Chip>
		{/snippet}
	</ChipModalFooter>
</ChipModal>
