<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { EscrowEvent, SettlementParty } from '@snapflow/api-client';
import { createInfiniteQuery } from '@tanstack/svelte-query';
import { paymentChannelsInfiniteQueryOptions } from '#lib/api/settlement/channels.ts';
import PanelSection from '#lib/components/detail/panel-section.svelte';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import AddressDisplay from '#lib/components/ui/address/address-display.svelte';
import Money from '#lib/components/ui/money.svelte';
import StatusLabel from '#lib/components/ui/status/status-label.svelte';
import Timestamp from '#lib/components/ui/timestamp.svelte';
import PaymentChannelDetails from '#lib/features/billing/components/channels/payment-channel-details.svelte';
import {
	escrowEventChannelId,
	escrowEventDetail,
	escrowEventLabel,
	escrowEventReverted,
	escrowEventSigned,
	escrowEventSignedMicroUsd,
	escrowEventStatus,
} from '#lib/features/billing/lib/escrow-event.ts';
import {
	CURSOR_PAGE_SIZE,
	cursorPageItems,
	nextCursorPage,
} from '#lib/features/billing/lib/infinite-cursor.ts';

interface EscrowEventDetailsProps {
	escrowEvent: EscrowEvent;
	party: SettlementParty;
}

let { escrowEvent, party }: EscrowEventDetailsProps = $props();

const status = $derived(escrowEventStatus(escrowEvent));
const amount = $derived(escrowEventSignedMicroUsd(escrowEvent, party));
const detail = $derived(escrowEventDetail(escrowEvent));
const channelId = $derived(escrowEventChannelId(escrowEvent));
const channels = createInfiniteQuery(() => ({
	...paymentChannelsInfiniteQueryOptions({
		limit: CURSOR_PAGE_SIZE,
		role: party,
	}),
	initialPageParam: {},
	getNextPageParam: nextCursorPage,
	enabled: channelId !== undefined,
}));
const channel = $derived(
	channelId
		? cursorPageItems(channels.data).find(
				(each) => each.channelId.toLowerCase() === channelId.toLowerCase()
			)
		: undefined
);
</script>

<div class="flex flex-col">
	<PanelSection>
		<KeyValueList framed={false}>
			<KeyValueRow label="Event">
				<StatusLabel
					label={escrowEventLabel(escrowEvent, party)}
					shape={status.shape}
					tone={status.tone}
				/>
			</KeyValueRow>
			<KeyValueRow label="Amount">
				{#if amount !== null}
					<Money
						microUsd={amount}
						signed={escrowEventSigned(escrowEvent, party)}
						struck={escrowEventReverted(escrowEvent)}
						precise
					/>
				{/if}
			</KeyValueRow>
			{#if detail}
				<KeyValueRow label="Details" value={detail} />
			{/if}
			<KeyValueRow label="Date">
				<Timestamp value={escrowEvent.blockTimestamp} />
			</KeyValueRow>
			<KeyValueRow label="Hash">
				<AddressDisplay value={escrowEvent.transactionHash} kind="tx" />
			</KeyValueRow>
			<KeyValueRow
				label="Block"
				mono
				value={escrowEvent.blockNumber}
				copy={String(escrowEvent.blockNumber)}
			/>
		</KeyValueList>
	</PanelSection>
	{#if channelId}
		<PanelSection title="Channel">
			{#if channel}
				<PaymentChannelDetails paymentChannelId={channel.id} {party} />
			{:else}
				<KeyValueList framed={false}>
					<KeyValueRow
						label="Channel ID"
						mono
						value={channelId}
						copy={channelId}
					/>
				</KeyValueList>
			{/if}
		</PanelSection>
	{/if}
</div>
