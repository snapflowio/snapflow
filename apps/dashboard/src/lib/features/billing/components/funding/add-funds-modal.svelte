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

const FundingFrom = {
	Safe: 'safe',
	Connected: 'connected',
	Exchange: 'exchange',
} as const;

type FundingFrom = (typeof FundingFrom)[keyof typeof FundingFrom];

const ADDRESS_QR_SIZE_PX = 128;
const NO_SAFE_REASON = 'Create your Snapflow wallet first';
const CLOSE_HINT = "You can close this. We'll keep tracking it.";
const PAYMENTS_INFO =
	'Snapflow pays your hosts from the escrow as sandboxes run, up to a suggested hourly limit you can change later. Without it, billable sandboxes cannot start.';
</script>

<script lang="ts">
import Check from '@lucide/svelte/icons/check';
import Copy from '@lucide/svelte/icons/copy';
import { watch } from 'runed';
import { userErrorMessage } from '#lib/api/errors/api-error-details.ts';
import InfoTooltip from '#lib/components/page/info-tooltip.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import AddressDisplay from '#lib/components/ui/address/address-display.svelte';
import LabeledCheckbox from '#lib/components/ui/checkbox/labeled-checkbox.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipMoneyInput from '#lib/components/ui/chip/chip-money-input.svelte';
import ChipRadioCards from '#lib/components/ui/chip/chip-radio-cards.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalError from '#lib/components/ui/chip-modal/chip-modal-error.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import ChipModalReviewSection from '#lib/components/ui/chip-modal/chip-modal-review-section.svelte';
import { CopyToClipboard } from '#lib/components/ui/clipboard/copy-to-clipboard.svelte.ts';
import QrCode from '#lib/components/ui/qr-code.svelte';
import {
	DEPOSIT_PRESETS_MICRO_USD,
	presetDisabledReason,
} from '#lib/features/billing/lib/escrow-amount.ts';
import { formatSeconds } from '#lib/features/billing/lib/escrow-terms.ts';
import { PendingDepositState } from '#lib/features/billing/lib/pending-escrow.ts';
import type { BillingFunding } from '#lib/features/billing/state/billing-funding.svelte.ts';
import { EscrowDeposit } from '#lib/features/billing/state/escrow-deposit.svelte.ts';
import { FundingSigner } from '#lib/features/billing/state/funding-source.svelte.ts';
import ConnectWalletMenu from '#lib/features/wallet/components/connect-wallet-menu.svelte';
import { shortAddress } from '#lib/features/wallet/lib/payment-wallet.ts';
import { settlementChain } from '#lib/integrations/wallet/wallet-networks.ts';
import { formatUsd } from '#lib/utils/usd.ts';
import ModalIntro from '../finance/modal-intro.svelte';
import DepositProgress from './deposit-progress.svelte';

interface AddFundsModalProps {
	open?: boolean;
	funding: BillingFunding;
}

let { open = $bindable(false), funding }: AddFundsModalProps = $props();

const amountId = $props.id();
const source = $derived(funding.source);
const networkName = $derived(
	settlementChain(funding.wallet.settlement.chainId).name
);
const clipboard = new CopyToClipboard();
const deposit = new EscrowDeposit({
	source: () => funding.source,
	account: () => funding.account.data,
	minimum: () => funding.minimumDeposit,
	delegation: () => funding.delegation.data,
	observed: (hash) =>
		funding.pending.rows.some(
			(row) =>
				row.kind === 'deposit' &&
				row.state !== PendingDepositState.Sent &&
				row.transactionHash.toLowerCase() === hash.toLowerCase()
		),
});
let from = $state<FundingFrom>(FundingFrom.Exchange);

const fundingAddress = $derived(source.account);
const pending = $derived(deposit.mutation.isPending);
const tracking = $derived(deposit.progress !== null);
const failure = $derived(
	deposit.mutation.isError ? userErrorMessage(deposit.mutation.error) : null
);
const safeBalance = $derived(funding.wallet.balance.data);
const options = $derived<ChipRadioCard<FundingFrom>[]>([
	{
		value: FundingFrom.Safe,
		title: 'Snapflow wallet',
		meta:
			safeBalance === undefined ? undefined : formatUsd(safeBalance.toString()),
		disabledReason: source.safeAvailable ? undefined : NO_SAFE_REASON,
	},
	{
		value: FundingFrom.Connected,
		title: 'Connected wallet',
		meta: funding.connected.address
			? shortAddress(funding.connected.address)
			: 'Connect a browser wallet',
	},
	{
		value: FundingFrom.Exchange,
		title: 'Exchange or other wallet',
		meta: 'Send USDC to your funding wallet',
	},
]);
const submitLabel = $derived(
	deposit.amount === null
		? 'Deposit'
		: `Deposit ${formatUsd(deposit.amount.toString())}`
);

function defaultFrom(): FundingFrom {
	if (source.payer === FundingSigner.Safe) return FundingFrom.Safe;
	if (source.payer === FundingSigner.Connected) return FundingFrom.Connected;
	return FundingFrom.Exchange;
}

watch(
	() => open,
	(isOpen) => {
		if (!isOpen) return;
		deposit.reset();
		source.preferredPayer = null;
		from = defaultFrom();
	}
);

function choose(next: FundingFrom): void {
	from = next;
	if (next === FundingFrom.Safe) source.preferredPayer = FundingSigner.Safe;
	if (next === FundingFrom.Connected) {
		source.preferredPayer = FundingSigner.Connected;
	}
}

function close(): void {
	if (pending) return;
	open = false;
}

function submit(event: SubmitEvent): void {
	event.preventDefault();
	if (from === FundingFrom.Exchange || tracking) return;
	deposit.submit();
}
</script>

{#snippet presets()}
	<div class="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
		{#each DEPOSIT_PRESETS_MICRO_USD as preset (preset)}
			<Chip
				size="compact"
				class="max-sm:w-full"
				variant="secondary"
				active={deposit.amount === preset}
				disabledReason={presetDisabledReason(
					preset,
					funding.minimumDeposit,
					deposit.room
				)}
				onclick={() => {
					deposit.amount = preset;
				}}
			>
				{formatUsd(preset.toString())}
			</Chip>
		{/each}
	</div>
{/snippet}

<ChipModal
	bind:open
	srTitle="Add funds"
	dismissDisabled={pending}
	hasUnsavedInput={!tracking && deposit.amount !== null}
	onsubmit={submit}
>
	<ChipModalHeader onClose={close} closeDisabled={pending}>
		Add funds
	</ChipModalHeader>
	<ChipModalBody>
		{#if tracking && deposit.progress}
			<DepositProgress
				progress={deposit.progress}
				signerLabel={source.payerLabel ?? 'your wallet'}
				{networkName}
				transactionHash={deposit.receipt?.transactionHash ?? null}
			/>
		{:else}
			<ModalIntro
				description={`Deposit USDC on ${networkName} into the escrow that pays your hosts.`}
			/>
			<ChipModalField label="From">
				<ChipRadioCards
					label="Pay from"
					{options}
					value={from}
					onValueChange={choose}
				/>
			</ChipModalField>
			{#if from === FundingFrom.Connected && !funding.connected.ready}
				<div class="flex justify-end">
					<ConnectWalletMenu connected={funding.connected} />
				</div>
			{/if}
			{#if from === FundingFrom.Exchange}
				{#if fundingAddress}
					<div class="flex flex-col gap-3">
						<AddressDisplay value={fundingAddress} form="full" />
						<div class="flex items-end gap-4">
							<QrCode
								value={fundingAddress}
								label="Funding wallet address QR code"
								size={ADDRESS_QR_SIZE_PX}
							/>
							<div class="flex min-w-0 flex-col gap-2">
								<p class="text-(--text-secondary) text-sm">
									{`Send USDC on ${networkName} only.`}
								</p>
								<Chip
									variant="secondary"
									leftIcon={clipboard.copied ? Check : Copy}
									onclick={() => void clipboard.copy(fundingAddress)}
								>
									{clipboard.label('Copy address')}
								</Chip>
							</div>
						</div>
					</div>
				{:else}
					<p class="text-(--text-muted) text-sm">
						{source.depositHint}
					</p>
				{/if}
			{:else}
				<ChipModalField label="Amount" for={amountId}>
					<ChipMoneyInput
						id={amountId}
						bind:value={deposit.amount}
						placeholder="0.00"
						error={deposit.error !== null}
						disabled={pending}
					/>
					{@render presets()}
				</ChipModalField>
				<ChipModalReviewSection title="Review">
					<KeyValueRow
						align="end"
						label="Amount"
						value={deposit.amount === null
							? null
							: formatUsd(deposit.amount.toString())}
					/>
					<KeyValueRow
						align="end"
						label="Network fee"
						value={source.payer === FundingSigner.Safe
							? 'Paid in USDC, shown before you approve'
							: 'Paid by the connected wallet'}
					/>
					<KeyValueRow
						align="end"
						label="Available after"
						value={formatUsd(deposit.availableAfter.toString())}
					/>
					<KeyValueRow
						align="end"
						label="Lasts"
						value={deposit.runwayAfterSeconds === null
							? 'Nothing running'
							: formatSeconds(deposit.runwayAfterSeconds)}
					/>
				</ChipModalReviewSection>
				{#if deposit.offersAutomaticPayments}
					<div class="flex items-start gap-1.5">
						<LabeledCheckbox
							bind:checked={deposit.turnOnAutomaticPayments}
							disabled={pending}
						>
							Turn on automatic payments
						</LabeledCheckbox>
						<InfoTooltip content={PAYMENTS_INFO} />
					</div>
				{/if}
				{#if !source.payer && source.depositHint}
					<p class="text-(--text-muted) text-sm">
						{source.depositHint}
					</p>
				{/if}
				<ChipModalError message={deposit.error ?? failure} />
			{/if}
		{/if}
	</ChipModalBody>
	{#if tracking}
		<ChipModalFooter
			onCancel={close}
			cancelLabel="Close"
			cancelDisabled={pending}
			defaultAction="dismiss"
		>
			{#snippet leadingContent()}
				<span class="text-(--text-muted) text-xs">{CLOSE_HINT}</span>
			{/snippet}
		</ChipModalFooter>
	{:else if from === FundingFrom.Exchange}
		<ChipModalFooter
			onCancel={close}
			cancelLabel="Done"
			defaultAction="dismiss"
		/>
	{:else}
		<ChipModalFooter onCancel={close} cancelDisabled={pending}>
			{#snippet primaryAction()}
				<Chip
					type="submit"
					variant="primary"
					loading={pending}
					disabled={!deposit.ready}
				>
					{submitLabel}
				</Chip>
			{/snippet}
		</ChipModalFooter>
	{/if}
</ChipModal>
