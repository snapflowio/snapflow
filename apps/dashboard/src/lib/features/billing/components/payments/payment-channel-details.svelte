<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { createQuery } from '@tanstack/svelte-query';
import { paymentChannelQueryOptions } from '#lib/api/settlement/channels.ts';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import QueryFeedbackState from '#lib/components/query-feedback-state.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import DetailsCopyRow from '#lib/features/billing/components/details/details-copy-row.svelte';
import DetailsField from '#lib/features/billing/components/details/details-field.svelte';
import {
	paymentChannelSubject,
	SIGNING_MODE_LABELS,
} from '#lib/features/billing/lib/payment-channel.ts';
import { formatDateTime } from '#lib/utils/format.ts';
import { titleCase } from '#lib/utils/text.ts';
import { formatUsd } from '#lib/utils/usd.ts';

interface PaymentChannelDetailsProps {
	channelId: string;
}

let { channelId }: PaymentChannelDetailsProps = $props();

const channel = createQuery(() => paymentChannelQueryOptions(channelId));
</script>

{#snippet row(
	rowLabel: string,
	rowValue: string
)}
	<KeyValueRow>
		{#snippet label()}
			{rowLabel}
		{/snippet}
		{#snippet value()}
			{rowValue}
		{/snippet}
	</KeyValueRow>
{/snippet}

{#snippet heading(
	text: string
)}
	<h3 class="mt-1.5 pl-0.5 text-(--text-tertiary) text-caption">{text}</h3>
{/snippet}

{#if channel.isSuccess}
	{const data = $derived(channel.data)}
	{const voucher = $derived(data.latestVoucher)}
	<div class="flex flex-col gap-2.5 pt-1">
		{#if data.voucherError}
			<Notice tone="error">
				{#snippet title()}
					The latest voucher could not be signed
				{/snippet}
				{#snippet description()}
					{data.voucherError}
				{/snippet}
			</Notice>
		{/if}
		{#if data.claimError}
			<Notice tone="warning">
				{#snippet title()}
					The escrow refused the last claim
				{/snippet}
				{#snippet description()}
					{data.claimError}
				{/snippet}
			</Notice>
		{/if}
		<div class="grid grid-cols-3 gap-x-3 pb-0.5">
			<DetailsField label="Paid for" value={paymentChannelSubject(data)} />
			<DetailsField label="Status" value={titleCase(data.state)} />
			<DetailsField
				label="Signing"
				value={SIGNING_MODE_LABELS[data.signingMode]}
			/>
		</div>
		{@render heading('Channel')}
		<KeyValueList>
			<DetailsCopyRow label="Channel ID" value={data.channelId} />
			<DetailsCopyRow label="Funding wallet" value={data.customerAddress} />
			<DetailsCopyRow label="Paid to" value={data.hostAddress} />
			{@render row('Opened', formatDateTime(data.openedAt))}
			{#if data.closedAt}
				{@render row('Closed', formatDateTime(data.closedAt))}
			{/if}
			{@render row('Covered until', formatDateTime(data.coveredAt))}
			{@render row('Last claimed voucher', String(data.claimedSequence))}
		</KeyValueList>
		{#if voucher}
			{@render heading(`Latest voucher · #${voucher.sequence}`)}
			<KeyValueList>
				{@render row('Host', formatUsd(voucher.message.hostAmount))}
				{@render row('Snapflow fee', formatUsd(voucher.message.feeAmount))}
				{@render row('Services', formatUsd(voucher.message.serviceAmount))}
				{@render row('Issued', formatDateTime(voucher.issuedAt))}
				{@render row('Expires', formatDateTime(voucher.expiresAt))}
				{#if voucher.signerAddress && voucher.signedAt}
					<DetailsCopyRow label="Signed by" value={voucher.signerAddress} />
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
		loadingMessage="Loading the payment channel..."
		errorMessage="The payment channel could not be loaded."
	/>
{/if}
