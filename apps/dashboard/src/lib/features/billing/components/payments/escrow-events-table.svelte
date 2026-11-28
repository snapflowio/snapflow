<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { EscrowEvent, SettlementParty } from '@snapflow/api-client';
import { renderSnippet } from '@tanstack/svelte-table';
import type { Snippet } from 'svelte';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import { EMPTY_CELL_PLACEHOLDER } from '#lib/components/resource/table/resource-table.ts';
import { resourceColumnHelper } from '#lib/components/resource/table/resource-table-model.ts';
import {
	addressCell,
	timestampCell,
} from '#lib/components/resource/table/rich-cells.ts';

const column = resourceColumnHelper<EscrowEvent>();
const DATE_COLUMN_WIDTH = 140;
const DESCRIPTION_COLUMN_GROW = 2;
const STATUS_COLUMN_WIDTH = 136;
const AMOUNT_COLUMN_WIDTH = 104;
const TRANSACTION_COLUMN_WIDTH = 168;

interface EscrowEventsTableProps {
	caption: string;
	events: readonly EscrowEvent[];
	party: SettlementParty;
	errorMessage?: string;
	isLoading: boolean;
	isFetching?: boolean;
	onRetry: () => void;
	empty?: Snippet;
	emptyMessage: string;
	hasMore?: boolean;
	loadingMore?: boolean;
	onLoadMore?: () => void;
	selectedRowId?: string | null;
	onRowClick?: (id: string) => void;
	rowActions?: (escrowEvent: EscrowEvent) => ResourceRowAction[];
}
</script>

<script lang="ts">
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import Money from '#lib/components/ui/money.svelte';
import StatusLabel from '#lib/components/ui/status/status-label.svelte';
import {
	escrowEventDetail,
	escrowEventLabel,
	escrowEventReverted,
	escrowEventSigned,
	escrowEventSignedMicroUsd,
	escrowEventStatus,
} from '#lib/features/billing/lib/escrow-event.ts';

let {
	caption,
	events,
	party,
	errorMessage,
	isLoading,
	isFetching = false,
	onRetry,
	empty,
	emptyMessage,
	hasMore,
	loadingMore,
	onLoadMore,
	selectedRowId = null,
	onRowClick,
	rowActions,
}: EscrowEventsTableProps = $props();

const columns = $derived([
	column.accessor('blockTimestamp', {
		id: 'date',
		header: 'Date',
		meta: { width: DATE_COLUMN_WIDTH },
		cell: ({ getValue }) => timestampCell(getValue()),
	}),
	column.accessor('kind', {
		id: 'event',
		header: 'Description',
		meta: { grow: DESCRIPTION_COLUMN_GROW, compact: true },
		cell: ({ row }) => renderSnippet(eventCell, row.original),
	}),
	column.display({
		id: 'status',
		header: 'Status',
		meta: { width: STATUS_COLUMN_WIDTH },
		cell: ({ row }) => renderSnippet(statusCell, row.original),
	}),
	column.display({
		id: 'amount',
		header: 'Amount',
		meta: { width: AMOUNT_COLUMN_WIDTH, align: 'end', compact: true },
		cell: ({ row }) => renderSnippet(amountCell, row.original),
	}),
	column.accessor('transactionHash', {
		id: 'transaction',
		header: 'Transaction',
		meta: { width: TRANSACTION_COLUMN_WIDTH, visibleFrom: 'lg' },
		cell: ({ getValue }) => addressCell(getValue(), 'tx'),
	}),
	...(rowActions
		? [
				column.display({
					id: 'actions',
					header: 'Actions',
					meta: { variant: 'actions' },
					cell: ({ row }) => renderSnippet(actionsCell, row.original),
				}),
			]
		: []),
]);
</script>

{#snippet eventCell(escrowEvent: EscrowEvent)}
	{const detail = $derived(escrowEventDetail(escrowEvent))}
	<span class="min-w-0 truncate text-(--text-primary)">
		{escrowEventLabel(escrowEvent, party)}
		{#if detail}
			<span class="text-(--text-muted)">{`· ${detail}`}</span>
		{/if}
	</span>
{/snippet}

{#snippet statusCell(escrowEvent: EscrowEvent)}
	{const status = $derived(escrowEventStatus(escrowEvent))}
	<StatusLabel label={status.label} shape={status.shape} tone={status.tone} />
{/snippet}

{#snippet amountCell(escrowEvent: EscrowEvent)}
	{const amount = $derived(escrowEventSignedMicroUsd(escrowEvent, party))}
	{#if amount === null}
		<span class="text-(--text-muted)">{EMPTY_CELL_PLACEHOLDER}</span>
	{:else}
		<Money
			class="text-(--text-primary)"
			microUsd={amount}
			signed={escrowEventSigned(escrowEvent, party)}
			struck={escrowEventReverted(escrowEvent)}
		/>
	{/if}
{/snippet}

{#snippet actionsCell(escrowEvent: EscrowEvent)}
	{#if rowActions}
		<ResourceRowActions
			label={`Actions for ${escrowEventLabel(escrowEvent, party)}`}
			actions={rowActions(escrowEvent)}
		/>
	{/if}
{/snippet}

<ResourceDataTable
	{caption}
	{columns}
	data={events}
	getRowId={(escrowEvent) => escrowEvent.id}
	rowLabel={(escrowEvent) => escrowEventLabel(escrowEvent, party)}
	{selectedRowId}
	{onRowClick}
	{isLoading}
	{isFetching}
	{errorMessage}
	{emptyMessage}
	{empty}
	{onRetry}
	{hasMore}
	{loadingMore}
	{onLoadMore}
/>
