<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { Payout } from '@snapflow/api-client';
import type { Snippet } from 'svelte';
import { renderResourceLabel } from '#lib/components/resource/table/resource-cell.ts';
import { resourceColumnHelper } from '#lib/components/resource/table/resource-table-model.ts';
import { timeCell } from '#lib/components/resource/table/time-cell.ts';
import { formatCents } from '#lib/utils/usd.ts';

const column = resourceColumnHelper<Payout>();

interface PayoutsTableProps {
	errorMessage?: string;
	isLoading: boolean;
	onRetry: () => void;
	payouts: readonly Payout[];
	empty?: Snippet;
	hasMore?: boolean;
	loadingMore?: boolean;
	onLoadMore?: () => void;
}
</script>

<script lang="ts">
import { renderSnippet } from '@tanstack/svelte-table';
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';

let {
	errorMessage,
	isLoading,
	onRetry,
	payouts,
	empty,
	hasMore,
	loadingMore,
	onLoadMore,
}: PayoutsTableProps = $props();

const columns = [
	column.accessor('createdAt', {
		id: 'created',
		header: 'Date',
		cell: ({ getValue }) => renderResourceLabel(timeCell(getValue())),
	}),
	column.accessor('amountCents', {
		id: 'amount',
		header: 'Amount',
		cell: ({ getValue }) =>
			renderResourceLabel({ label: formatCents(getValue()) }),
	}),
	column.accessor('state', {
		id: 'state',
		header: 'Status',
		cell: ({ row }) => renderSnippet(stateBadge, row.original),
	}),
	column.accessor('transferredAt', {
		id: 'transferred',
		header: 'Sent',
		cell: ({ getValue }) => renderResourceLabel(timeCell(getValue())),
	}),
];
</script>

{#snippet stateBadge(
	payout: Payout
)}
	<ResourceStateBadge state={payout.state} errorReason={payout.failureReason} />
{/snippet}

<ResourceDataTable
	caption="Payouts"
	{columns}
	data={payouts}
	getRowId={(payout) => payout.id}
	{isLoading}
	{errorMessage}
	emptyMessage="No payouts yet"
	{empty}
	{onRetry}
	{hasMore}
	{loadingMore}
	{onLoadMore}
/>
