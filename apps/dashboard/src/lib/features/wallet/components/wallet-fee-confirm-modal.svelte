<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import WalletFeeReview from '#lib/features/wallet/components/wallet-fee-review.svelte';
import {
	type WalletCallContracts,
	walletCallActions,
} from '#lib/features/wallet/lib/wallet-call.ts';
import type { WalletFeeConfirmation } from '#lib/features/wallet/state/wallet-fee-confirmation.svelte.ts';

interface WalletFeeConfirmModalProps {
	confirmation: WalletFeeConfirmation;
	contracts: WalletCallContracts;
}

let { confirmation, contracts }: WalletFeeConfirmModalProps = $props();

const actions = $derived(
	confirmation.prepared
		? walletCallActions(confirmation.prepared.transaction.call, contracts)
		: []
);
</script>

<ChipModalConfirm
	bind:open={
		() => confirmation.prepared !== null,
		(open) => {
	if (!open) confirmation.decline();
}
	}
	onsubmit={confirmation.approve}
	title="Review and approve"
	text="Your Snapflow wallet sends this transaction and pays its network fee."
>
	{#if confirmation.feeMicroUsd !== null}
		<WalletFeeReview feeMicroUsd={confirmation.feeMicroUsd}>
			{#each actions as action, index (index)}
				<KeyValueRow align="end" label="Action" value={action.label} />
				{#if action.detail}
					<KeyValueRow
						align="end"
						label={action.detailLabel}
						value={action.detail}
					/>
				{/if}
			{:else}
				<KeyValueRow
					align="end"
					label="Action"
					value="Not recognized: decline unless you started it"
				/>
			{/each}
		</WalletFeeReview>
	{/if}
	{#snippet confirm()}
		<Chip type="submit" variant="primary"> Approve with passkey </Chip>
	{/snippet}
</ChipModalConfirm>
