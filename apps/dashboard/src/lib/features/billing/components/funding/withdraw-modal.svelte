<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const NOTHING_TO_WITHDRAW = 'Nothing to withdraw.';
</script>

<script lang="ts">
import type { EscrowAccount } from '@snapflow/api-client';
import { watch } from 'runed';
import { userErrorMessage } from '#lib/api/errors/api-error-details.ts';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipMoneyInput from '#lib/components/ui/chip/chip-money-input.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalError from '#lib/components/ui/chip-modal/chip-modal-error.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import ChipModalReviewSection from '#lib/components/ui/chip-modal/chip-modal-review-section.svelte';
import {
	WalletTab,
	walletTabHref,
} from '#lib/features/billing/lib/billing-wallet.ts';
import {
	formatRemaining,
	formatSeconds,
} from '#lib/features/billing/lib/escrow-terms.ts';
import { EscrowWithdrawal } from '#lib/features/billing/state/escrow-withdrawal.svelte.ts';
import type { FundingSource } from '#lib/features/billing/state/funding-source.svelte.ts';
import { formatDate, formatDateTime } from '#lib/utils/format.ts';
import { formatUsd } from '#lib/utils/usd.ts';
import ModalIntro from '../finance/modal-intro.svelte';

interface WithdrawModalProps {
	open?: boolean;
	account: EscrowAccount;
	source: FundingSource;
}

let { open = $bindable(false), account, source }: WithdrawModalProps = $props();

const amountId = $props.id();
const withdrawal = new EscrowWithdrawal(
	() => account,
	() => source
);
const pending = $derived(withdrawal.request.isPending);
const failure = $derived(
	withdrawal.request.isError ? userErrorMessage(withdrawal.request.error) : null
);
const delay = $derived(formatSeconds(account.windows.withdrawalDelaySeconds));
const blocker = $derived.by(() => {
	if (account.blockedAt) {
		return account.blockedUntil
			? `This wallet is frozen until ${formatDate(account.blockedUntil)}.`
			: 'This wallet is frozen.';
	}
	if (withdrawal.hasPending) {
		const remaining = account.withdrawalUnlocksInSeconds;
		const when =
			remaining === 0
				? 'It is ready to complete from Billing.'
				: `It unlocks in ${formatRemaining(remaining ?? account.windows.withdrawalDelaySeconds)}; cancel or complete it from Billing.`;
		return `You already asked to withdraw ${formatUsd(account.pendingMicroUsd)}. ${when}`;
	}
	if (withdrawal.free === 0n) return NOTHING_TO_WITHDRAW;
	return source.signer ? null : source.hint;
});
const needsFundingWallet = $derived(
	blocker !== null && blocker === source.hint && !source.signer
);
const submitLabel = $derived(
	withdrawal.amount === null
		? 'Request withdrawal'
		: `Request withdrawal of ${formatUsd(withdrawal.amount.toString())}`
);

watch(
	() => open,
	(isOpen) => {
		if (!isOpen) return;
		withdrawal.reset();
		withdrawal.request.reset();
	}
);

function close(): void {
	if (pending) return;
	open = false;
}

function submit(event: SubmitEvent): void {
	event.preventDefault();
	withdrawal.submit(() => {
		open = false;
	});
}
</script>

{#snippet manageFundingWallet()}
	<Chip variant="secondary" href={walletTabHref(WalletTab.Funding)}>
		Manage funding wallet
	</Chip>
{/snippet}

{#snippet withdrawAll()}
	<Chip
		size="compact"
		class="mr-1"
		disabled={pending}
		onclick={withdrawal.withdrawAll}
	>
		Withdraw all
	</Chip>
{/snippet}

<ChipModal
	bind:open
	srTitle="Withdraw"
	dismissDisabled={pending}
	hasUnsavedInput={withdrawal.amount !== null}
	onsubmit={submit}
>
	<ChipModalHeader onClose={close} closeDisabled={pending}>
		Withdraw
	</ChipModalHeader>
	<ChipModalBody>
		{#if blocker}
			<ModalIntro description={blocker} />
		{:else}
			<ModalIntro
				description={`${formatUsd(withdrawal.free.toString())} can be withdrawn to your funding wallet.`}
			/>
			<ChipModalField label="Amount" for={amountId}>
				<ChipMoneyInput
					id={amountId}
					bind:value={withdrawal.amount}
					placeholder="0.00"
					error={withdrawal.error !== null}
					disabled={pending}
					trailing={withdrawAll}
				/>
			</ChipModalField>
			<ChipModalReviewSection title="Review">
				<KeyValueRow
					align="end"
					label="Unlocks"
					value={formatDateTime(withdrawal.unlocksAt(new Date()))}
				/>
				<KeyValueRow
					align="end"
					label="Available after"
					value={formatUsd(withdrawal.availableAfter.toString())}
				/>
				<KeyValueRow
					align="end"
					label="Lasts"
					value={withdrawal.runwayAfterSeconds === null
						? 'Nothing running'
						: formatSeconds(withdrawal.runwayAfterSeconds)}
				/>
			</ChipModalReviewSection>
			<p class="text-(--text-muted) text-sm">
				{`Hosts can still claim what you owe them for ${delay}. After that you complete the withdrawal to send it to your funding wallet.`}
			</p>
			<ChipModalError message={withdrawal.error ?? failure} />
		{/if}
	</ChipModalBody>
	{#if blocker}
		<ChipModalFooter
			onCancel={close}
			cancelLabel="Close"
			defaultAction="dismiss"
			primaryAdjacentAction={needsFundingWallet
				? manageFundingWallet
				: undefined}
		/>
	{:else}
		<ChipModalFooter onCancel={close} cancelDisabled={pending}>
			{#snippet primaryAction()}
				<Chip
					type="submit"
					variant="primary"
					loading={pending}
					disabled={!withdrawal.ready}
				>
					{submitLabel}
				</Chip>
			{/snippet}
		</ChipModalFooter>
	{/if}
</ChipModal>
