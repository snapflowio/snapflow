<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { EscrowEvent, EscrowEventParty } from '@snapflow/api-client';
import type { Snippet } from 'svelte';
import { renderResourceLabel } from '#lib/components/resource/table/resource-cell.ts';
import { resourceColumnHelper } from '#lib/components/resource/table/resource-table-model.ts';
import { timeCell } from '#lib/components/resource/table/time-cell.ts';
import {
	escrowEventAmountMicroUsd,
	escrowEventChannelId,
	escrowEventLabel,
	escrowEventSessionKey,
} from '#lib/features/billing/lib/escrow-event.ts';
import { shortAddress } from '#lib/features/billing/lib/payment-wallet.ts';
import { formatUsd } from '#lib/utils/usd.ts';

const column = resourceColumnHelper<EscrowEvent>();

interface EscrowEventsTableProps {
	caption: string;
	events: readonly EscrowEvent[];
	party: EscrowEventParty;
	errorMessage?: string;
	isLoading: boolean;
	onRetry: () => void;
	empty?: Snippet;
	emptyMessage: string;
	hasMore?: boolean;
	loadingMore?: boolean;
	onLoadMore?: () => void;
}

function eventDetail(event: EscrowEvent): string | undefined {
	const reference = escrowEventChannelId(event) ?? escrowEventSessionKey(event);
	return reference ? shortAddress(reference) : undefined;
}
</script>

<script lang="ts">
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';

let {
	caption,
	events,
	party,
	errorMessage,
	isLoading,
	onRetry,
	empty,
	emptyMessage,
	hasMore,
	loadingMore,
	onLoadMore,
}: EscrowEventsTableProps = $props();

const columns = $derived([
	column.accessor('blockTimestamp', {
		id: 'time',
		header: 'Date',
		cell: ({ getValue }) => renderResourceLabel(timeCell(getValue())),
	}),
	column.accessor('kind', {
		id: 'event',
		header: 'Event',
		cell: ({ row }) =>
			renderResourceLabel({
				label: escrowEventLabel(row.original),
				sublabel: eventDetail(row.original),
			}),
	}),
	column.display({
		id: 'amount',
		header: 'Amount',
		cell: ({ row }) => {
			const amount = escrowEventAmountMicroUsd(row.original, party);
			return renderResourceLabel({ label: amount ? formatUsd(amount) : null });
		},
	}),
	column.accessor('transactionHash', {
		id: 'transaction',
		header: 'Transaction',
		cell: ({ getValue }) =>
			renderResourceLabel({ label: shortAddress(getValue()) }),
	}),
]);
</script>

<ResourceDataTable
	{caption}
	{columns}
	data={events}
	getRowId={(event) => event.id}
	{isLoading}
	{errorMessage}
	{emptyMessage}
	{empty}
	{onRetry}
	{hasMore}
	{loadingMore}
	{onLoadMore}
/>
