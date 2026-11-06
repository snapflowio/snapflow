<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { PaymentChannel } from '@snapflow/api-client';
import { renderResourceLabel } from '#lib/components/resource/table/resource-cell.ts';
import { resourceColumnHelper } from '#lib/components/resource/table/resource-table-model.ts';
import { timeCell } from '#lib/components/resource/table/time-cell.ts';
import {
	paymentChannelSubject,
	SIGNING_MODE_LABELS,
	voucherTotalMicroUsd,
} from '#lib/features/billing/lib/payment-channel.ts';
import { formatUsd } from '#lib/utils/usd.ts';

const CHANNEL_PARAM = 'channel';
const column = resourceColumnHelper<PaymentChannel>();
</script>

<script lang="ts">
import { createInfiniteQuery, keepPreviousData } from '@tanstack/svelte-query';
import { renderSnippet } from '@tanstack/svelte-table';
import { paymentChannelsInfiniteQueryOptions } from '#lib/api/settlement/channels.ts';
import EmptyState from '#lib/components/empty-state.svelte';
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import {
	CURSOR_PAGE_SIZE,
	cursorPageItems,
	nextCursorPage,
} from '#lib/features/billing/lib/infinite-cursor.ts';
import { paymentChannelIssue } from '#lib/features/billing/lib/payment-channel.ts';
import { OpenRowParam } from '#lib/routing/open-row-param.svelte.ts';
import PaymentChannelDetailsModal from './payment-channel-details-modal.svelte';

const channels = createInfiniteQuery(() => ({
	...paymentChannelsInfiniteQueryOptions({ limit: CURSOR_PAGE_SIZE }),
	initialPageParam: {},
	getNextPageParam: nextCursorPage,
	placeholderData: keepPreviousData,
}));
const rows = $derived(cursorPageItems(channels.data));
const panel = new OpenRowParam(
	() => rows,
	(channel) => channel.channelId,
	{ param: CHANNEL_PARAM, closeWithBack: true }
);

const columns = [
	column.accessor('openedAt', {
		id: 'opened',
		header: 'Opened',
		cell: ({ getValue }) => renderResourceLabel(timeCell(getValue())),
	}),
	column.display({
		id: 'subject',
		header: 'Paid for',
		cell: ({ row }) =>
			renderResourceLabel({ label: paymentChannelSubject(row.original) }),
	}),
	column.accessor('state', {
		id: 'state',
		header: 'Status',
		cell: ({ row }) => renderSnippet(stateBadge, row.original),
	}),
	column.accessor('signingMode', {
		id: 'signing',
		header: 'Signing',
		cell: ({ getValue }) =>
			renderResourceLabel({ label: SIGNING_MODE_LABELS[getValue()] }),
	}),
	column.accessor('latestVoucher', {
		id: 'paid',
		header: 'Signed total',
		cell: ({ getValue }) => {
			const voucher = getValue();
			return renderResourceLabel({
				label: voucher
					? formatUsd(voucherTotalMicroUsd(voucher.message))
					: null,
			});
		},
	}),
	column.accessor('coveredAt', {
		id: 'covered',
		header: 'Covered until',
		cell: ({ getValue }) => renderResourceLabel(timeCell(getValue())),
	}),
];
</script>

{#snippet stateBadge(
	channel: PaymentChannel
)}
	<ResourceStateBadge
		state={channel.state}
		errorReason={paymentChannelIssue(channel)}
	/>
{/snippet}

{#snippet empty()}
	<EmptyState
		title="No payment channels yet"
		description="Each priced sandbox gets a channel that pays its host through vouchers."
	/>
{/snippet}

<ResourceDataTable
	caption="Payment channels"
	{columns}
	data={rows}
	getRowId={(channel) => channel.channelId}
	rowLabel={(channel) =>
		`Open the channel for ${paymentChannelSubject(channel)}`}
	onRowClick={panel.open}
	selectedRowId={panel.openId}
	isLoading={channels.isLoading}
	errorMessage={channels.isError
		? 'Failed to load payment channels'
		: undefined}
	emptyMessage="No payment channels yet"
	{empty}
	onRetry={() => void channels.refetch()}
	hasMore={channels.hasNextPage}
	loadingMore={channels.isFetchingNextPage}
	onLoadMore={() => void channels.fetchNextPage()}
/>
<PaymentChannelDetailsModal channelId={panel.openId} onClose={panel.close} />
