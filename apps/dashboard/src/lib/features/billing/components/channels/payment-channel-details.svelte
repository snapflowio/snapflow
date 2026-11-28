<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { SettlementParty, VoucherLimit } from '@snapflow/api-client';
import { createQuery } from '@tanstack/svelte-query';
import { paymentChannelQueryOptions } from '#lib/api/settlement/channels.ts';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import QueryFeedbackState from '#lib/components/query-feedback-state.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import { fundingDialogHref } from '#lib/features/billing/lib/funding-dialog-link.ts';
import {
	paymentChannelSubject,
	paymentChannelUnclaimedMicroUsd,
	paymentChannelVoucherStatus,
	SIGNING_MODE_LABELS,
	VOUCHER_LIMIT_LABELS,
} from '#lib/features/billing/lib/payment-channel.ts';
import { FundingDialog } from '#lib/routing/funding-dialog.ts';
import { formatBasisPointsPercent, formatDateTime } from '#lib/utils/format.ts';
import { formatUsd } from '#lib/utils/usd.ts';

interface PaymentChannelDetailsProps {
	paymentChannelId: string;
	party: SettlementParty;
}

let { paymentChannelId, party }: PaymentChannelDetailsProps = $props();

const channel = createQuery(() => paymentChannelQueryOptions(paymentChannelId));
</script>

{#snippet row(rowLabel: string, rowValue: string)}
	<KeyValueRow>
		{#snippet label()}
			{rowLabel}
		{/snippet}
		{#snippet value()}
			{rowValue}
		{/snippet}
	</KeyValueRow>
{/snippet}

{#snippet heading(text: string)}
	<h3 class="mt-1.5 pl-0.5 text-(--text-tertiary) text-xs">{text}</h3>
{/snippet}

{#if channel.isSuccess}
	{const data = $derived(channel.data)}
	{const voucher = $derived(data.latestVoucher)}
	{const voucherLimit = $derived(data.voucherError)}
	<div class="flex flex-col gap-2.5 pt-1">
		{#if voucherLimit}
			<Notice tone="error">
				{#snippet title()}
					The latest payment is held back
				{/snippet}
				{#snippet info()}
					{voucherLimit === VoucherLimit.SignerCap
						? `${VOUCHER_LIMIT_LABELS[voucherLimit]}. Raise the spending limit so Snapflow can keep paying for these sandboxes.`
						: VOUCHER_LIMIT_LABELS[voucherLimit]}
				{/snippet}
				{#snippet action()}
					{#if voucherLimit === VoucherLimit.SignerCap &&
						party === SettlementParty.Customer}
						<Chip
							variant="primary"
							href={fundingDialogHref(FundingDialog.SignerLimit)}
						>
							Raise limit
						</Chip>
					{/if}
				{/snippet}
			</Notice>
		{/if}
		<div class="grid grid-cols-2 gap-x-3 gap-y-2 pb-0.5 sm:grid-cols-3">
			<KeyValueRow label="Paid to" value={paymentChannelSubject(data)} />
			<KeyValueRow label="Payments" value={paymentChannelVoucherStatus(data)} />
			<KeyValueRow
				label="Signing"
				value={SIGNING_MODE_LABELS[data.signingMode]}
			/>
		</div>
		{@render heading('Funds')}
		<KeyValueList framed={false}>
			{@render row('Charged', formatUsd(data.chargedMicroUsd))}
			{@render row('Signed', formatUsd(data.signedMicroUsd))}
			{@render row('Claimed', formatUsd(data.claimedMicroUsd))}
			{#if party === SettlementParty.Host}
				{@render row(
					'Unclaimed',
					formatUsd(paymentChannelUnclaimedMicroUsd(data))
				)}
			{/if}
			{@render row('Covered until', formatDateTime(data.coveredAt))}
			{@render row(
				'Last claimed',
				data.lastClaimedAt ? formatDateTime(data.lastClaimedAt) : 'Never'
			)}
		</KeyValueList>
		{@render heading('Terms')}
		<KeyValueList framed={false}>
			<KeyValueRow
				mono
				copy={data.channelId}
				label="Channel ID"
				value={data.channelId}
			/>
			<KeyValueRow
				mono
				copy={data.customerAddress}
				label="Funding wallet"
				value={data.customerAddress}
			/>
			<KeyValueRow
				mono
				copy={data.hostAddress}
				label="Host"
				value={data.hostAddress}
			/>
			{@render row('Snapflow fee', formatBasisPointsPercent(data.feeBps))}
			{@render row('Opened', formatDateTime(data.createdAt))}
		</KeyValueList>
		{#if data.charges.length > 0}
			{@render heading('Sandboxes')}
			<KeyValueList framed={false}>
				{#each data.charges as charge (charge.placementPriceId)}
					{@render row(charge.sandboxId, formatUsd(charge.chargedMicroUsd))}
				{/each}
			</KeyValueList>
		{/if}
		{#if voucher}
			{@render heading(`Latest payment · #${voucher.sequence}`)}
			<KeyValueList framed={false}>
				{@render row('Total', formatUsd(voucher.message.cumulativeAmount))}
				{@render row('Issued', formatDateTime(voucher.issuedAt))}
				{#if voucher.signerAddress && voucher.signedAt}
					<KeyValueRow
						mono
						copy={voucher.signerAddress}
						label="Signed by"
						value={voucher.signerAddress}
					/>
					{@render row('Signed', formatDateTime(voucher.signedAt))}
				{:else}
					{@render row('Signature', 'Waiting for a signature')}
				{/if}
			</KeyValueList>
		{/if}
	</div>
{:else}
	<QueryFeedbackState
		query={channel}
		loadingMessage="Loading the payment channel"
		errorMessage="The payment channel could not be loaded."
	/>
{/if}
