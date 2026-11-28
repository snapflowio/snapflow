<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const SEND_INFO =
	'Send USDC to your deposit address at an exchange that accepts USDC on this network. A transfer cannot be undone.';
</script>

<script lang="ts">
import { watch } from 'runed';
import InfoTooltip from '#lib/components/page/info-tooltip.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipInputPrefix from '#lib/components/ui/chip/chip-input-prefix.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalError from '#lib/components/ui/chip-modal/chip-modal-error.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import WalletFeeReview from '#lib/features/wallet/components/wallet-fee-review.svelte';
import { shortAddress } from '#lib/features/wallet/lib/payment-wallet.ts';
import { UsdcSend } from '#lib/features/wallet/state/usdc-send.svelte.ts';
import type { UserWalletState } from '#lib/features/wallet/state/user-wallet.svelte.ts';
import { formatUsd } from '#lib/utils/usd.ts';

interface SendUsdcModalProps {
	open?: boolean;
	wallet: UserWalletState;
	onSetUpRecovery: () => void;
}

let {
	open = $bindable(false),
	wallet,
	onSetUpRecovery,
}: SendUsdcModalProps = $props();

const fieldId = $props.id();
const ids = {
	recipient: `${fieldId}-recipient`,
	amount: `${fieldId}-amount`,
};
const send = new UsdcSend(() => wallet);
const problem = $derived(send.recipientError ?? send.amountError);
const reviewing = $derived(send.prepared !== null);
const busy = $derived(send.pending);
const dirty = $derived(send.recipient !== '' || send.amount !== '');

watch(
	() => open,
	(isOpen) => {
		if (isOpen) return;
		send.cancel();
	}
);

function close(): void {
	if (send.mutation.isPending) return;
	open = false;
}

function submit(event: SubmitEvent): void {
	event.preventDefault();
	if (reviewing) {
		send.confirm(() => {
			open = false;
		});
		return;
	}
	send.review();
}
</script>

{#snippet dollarPrefix()}
	<ChipInputPrefix>$</ChipInputPrefix>
{/snippet}

<ChipModal
	bind:open
	srTitle="Send USDC"
	dismissDisabled={send.mutation.isPending}
	hasUnsavedInput={dirty}
	onsubmit={submit}
>
	<ChipModalHeader onClose={close} closeDisabled={send.mutation.isPending}>
		<span class="flex items-center gap-1.5">
			Send USDC
			<InfoTooltip content={SEND_INFO} />
		</span>
	</ChipModalHeader>
	<ChipModalBody>
		{#if !wallet.recoveryActive}
			<p class="text-(--text-muted) text-sm">
				Set up recovery before sending. USDC can leave your wallet only once a
				second owner can recover it.
			</p>
		{:else if reviewing && send.feeMicroUsd !== null}
			<WalletFeeReview feeMicroUsd={send.feeMicroUsd}>
				<KeyValueRow
					align="end"
					label="To"
					value={shortAddress(send.recipient.trim())}
				/>
				{#if send.units !== null}
					<KeyValueRow
						align="end"
						label="Amount"
						value={formatUsd(send.units.toString())}
					/>
				{/if}
			</WalletFeeReview>
		{:else}
			<ChipModalField label="To" for={ids.recipient}>
				<ChipInput
					id={ids.recipient}
					class="font-mono"
					autocomplete="off"
					spellcheck={false}
					placeholder="Exchange deposit address (0x...)"
					bind:value={send.recipient}
					error={send.recipientError !== null}
					disabled={busy}
				/>
			</ChipModalField>
			<ChipModalField label="Amount" for={ids.amount}>
				<ChipInput
					id={ids.amount}
					inputmode="decimal"
					placeholder="0.00"
					bind:value={send.amount}
					error={send.amountError !== null}
					startAdornment={dollarPrefix}
					disabled={busy}
				/>
			</ChipModalField>
			<ChipModalError message={problem} />
		{/if}
	</ChipModalBody>
	{#if !wallet.recoveryActive}
		<ChipModalFooter onCancel={close}>
			{#snippet primaryAction()}
				<Chip variant="primary" onclick={onSetUpRecovery}>
					Set up recovery
				</Chip>
			{/snippet}
		</ChipModalFooter>
	{:else}
		<ChipModalFooter
			onCancel={reviewing ? send.cancel : close}
			cancelLabel={reviewing ? 'Back' : 'Cancel'}
			cancelDisabled={send.mutation.isPending}
		>
			{#snippet primaryAction()}
				<Chip
					type="submit"
					variant="primary"
					loading={reviewing
						? send.mutation.isPending
						: send.preparation.isPending}
					disabled={reviewing ? send.mutation.isPending : !send.ready}
				>
					{reviewing ? 'Approve and send' : 'Review'}
				</Chip>
			{/snippet}
		</ChipModalFooter>
	{/if}
</ChipModal>
