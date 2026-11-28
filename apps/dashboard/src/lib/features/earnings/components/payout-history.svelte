<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ChevronRight from '@lucide/svelte/icons/chevron-right';
import History from '@lucide/svelte/icons/history';
import { renderSnippet } from '@tanstack/svelte-table';
import EmptyState from '#lib/components/empty-state.svelte';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
import ResourceRowContextMenu from '#lib/components/resource/resource-row-context-menu.svelte';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import { EMPTY_CELL_PLACEHOLDER } from '#lib/components/resource/table/resource-table.ts';
import {
	type ResourceColumnDefs,
	resourceColumnHelper,
} from '#lib/components/resource/table/resource-table-model.ts';
import AddressDisplay from '#lib/components/ui/address/address-display.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import Money from '#lib/components/ui/money.svelte';
import OverflowText from '#lib/components/ui/overflow/overflow-text.svelte';
import Timestamp from '#lib/components/ui/timestamp.svelte';
import PayoutDetailsPanel from '#lib/features/earnings/components/payout-details-panel.svelte';
import {
	EARNINGS_STATUS,
	statusBadgeVariant,
} from '#lib/features/earnings/lib/earnings-status.ts';
import type { PayoutRow } from '#lib/features/earnings/lib/payout-rows.ts';
import type { PayoutHistory } from '#lib/features/earnings/state/payout-history.svelte.ts';
import { shortAddress } from '#lib/features/wallet/lib/payment-wallet.ts';
import { pluralize } from '#lib/utils/text.ts';
import { cn } from '#lib/utils/utils.ts';

interface PayoutHistoryProps {
	history: PayoutHistory;
	filtered: boolean;
	onClearFilter: () => void;
}

let { history, filtered, onClearFilter }: PayoutHistoryProps = $props();

const RETIRED_MACHINE_LABEL = 'Retired key';
const CLAIM_ROW_CLASS = 'bg-surface-3/40';
const PAID_OUT = EARNINGS_STATUS.paidOut;
const PAID_OUT_VARIANT = statusBadgeVariant(PAID_OUT);

const DATE_COLUMN_PX = 172;
const STATUS_COLUMN_PX = 136;
const MONEY_COLUMN_PX = 104;
const TRANSACTION_COLUMN_PX = 140;

const column = resourceColumnHelper<PayoutRow>();
const columns: ResourceColumnDefs<PayoutRow> = [
	column.display({
		id: 'date',
		header: 'Date',
		meta: { width: DATE_COLUMN_PX },
		cell: ({ row }) => renderSnippet(dateCell, row.original),
	}),
	column.display({
		id: 'machine',
		header: 'Machine',
		meta: { grow: 1 },
		cell: ({ row }) => renderSnippet(machineCell, row.original),
	}),
	column.display({
		id: 'status',
		header: 'Status',
		meta: { width: STATUS_COLUMN_PX, visibleFrom: 'md' },
		cell: ({ row }) => renderSnippet(statusCell, row.original),
	}),
	column.display({
		id: 'gross',
		header: 'Gross',
		meta: { align: 'end', width: MONEY_COLUMN_PX, visibleFrom: 'lg' },
		cell: ({ row }) => renderSnippet(grossCell, row.original),
	}),
	column.display({
		id: 'fee',
		header: 'Fees',
		meta: { align: 'end', width: MONEY_COLUMN_PX, visibleFrom: 'xl' },
		cell: ({ row }) => renderSnippet(feeCell, row.original),
	}),
	column.display({
		id: 'net',
		header: 'Net',
		meta: { align: 'end', width: MONEY_COLUMN_PX, compact: true },
		cell: ({ row }) => renderSnippet(netCell, row.original),
	}),
	column.display({
		id: 'transaction',
		header: 'Transaction',
		meta: { width: TRANSACTION_COLUMN_PX, visibleFrom: '2xl' },
		cell: ({ row }) => renderSnippet(transactionCell, row.original),
	}),
	column.display({
		id: 'actions',
		header: 'Actions',
		meta: { variant: 'actions' },
		cell: ({ row }) => renderSnippet(actionsCell, row.original),
	}),
];

const footer = $derived(
	history.payouts.length > 0 && !history.query.hasNextPage
		? pluralize(history.payouts.length, 'payout')
		: null
);
</script>

{#snippet placeholder()}
	<span class="text-(--text-subtle)">{EMPTY_CELL_PLACEHOLDER}</span>
{/snippet}

{#snippet dateCell(row: PayoutRow)}
	{#if row.kind === 'payout'}
		<span class="flex min-w-0 items-center gap-2">
			<ChevronRight
				aria-hidden="true"
				class={cn(
					'size-4 shrink-0 text-(--text-subtle) transition-transform duration-(--motion-quick) motion-reduce:transition-none',
					row.expanded && 'rotate-90',
					row.payout.claims.length === 0 && 'invisible'
				)}
			/>
			<Timestamp value={row.payout.paidAt} />
		</span>
	{:else}
		<span class="pl-6 text-(--text-muted)">
			<Timestamp value={row.claim.claimedAt} />
		</span>
	{/if}
{/snippet}

{#snippet machineCell(row: PayoutRow)}
	{#if row.kind === 'payout'}
		<OverflowText text={row.payout.machineName ?? RETIRED_MACHINE_LABEL} />
	{:else}
		<span class="truncate font-mono text-(--text-muted) text-xs">
			{`Channel ${shortAddress(row.claim.channelId)}`}
		</span>
	{/if}
{/snippet}

{#snippet statusCell(row: PayoutRow)}
	{#if row.kind === 'payout'}
		<Badge size="sm" variant={PAID_OUT_VARIANT}>{PAID_OUT.label}</Badge>
	{:else}
		{@render placeholder()}
	{/if}
{/snippet}

{#snippet grossCell(row: PayoutRow)}
	{#if row.kind === 'payout'}
		<Money microUsd={row.payout.grossMicroUsd} />
	{:else}
		<Money microUsd={row.claim.amountMicroUsd} class="text-(--text-muted)" />
	{/if}
{/snippet}

{#snippet feeCell(row: PayoutRow)}
	{#if row.kind === 'payout'}
		<Money
			microUsd={row.payout.feeMicroUsd}
			precise
			class="text-(--text-muted)"
		/>
	{:else}
		{@render placeholder()}
	{/if}
{/snippet}

{#snippet netCell(row: PayoutRow)}
	{#if row.kind === 'payout'}
		<Money microUsd={row.payout.netMicroUsd} class="text-(--text-primary)" />
	{:else}
		{@render placeholder()}
	{/if}
{/snippet}

{#snippet transactionCell(row: PayoutRow)}
	<AddressDisplay
		kind="tx"
		value={row.kind === 'payout'
			? row.payout.transactionHash
			: row.claim.transactionHash}
	/>
{/snippet}

{#snippet actionsCell(row: PayoutRow)}
	<ResourceRowActions
		label="Transaction actions"
		actions={history.rowActions(row)}
	/>
{/snippet}

{#snippet empty()}
	<EmptyState
		icon={History}
		bordered={false}
		title={filtered ? 'No payouts for this machine yet' : 'No payouts yet'}
	>
		<p>Payouts appear here once a machine reaches the payout minimum.</p>
		{#snippet actions()}
			{#if filtered}
				<Chip variant="secondary" onclick={onClearFilter}>
					Show all machines
				</Chip>
			{/if}
		{/snippet}
	</EmptyState>
{/snippet}

<ResourceRowContextMenu actionsFor={history.actionsFor}>
	<ResourceDataTable
		caption="Payouts"
		variant="framed"
		footer={footer ?? undefined}
		{columns}
		data={history.rows}
		getRowId={(row) => row.id}
		rowLabel={(row) =>
			row.kind === 'payout'
				? (row.payout.machineName ?? RETIRED_MACHINE_LABEL)
				: shortAddress(row.claim.channelId)}
		rowClass={(row) => (row.kind === 'claim' ? CLAIM_ROW_CLASS : '')}
		isLoading={history.query.isLoading}
		isFetching={history.query.isFetching && !history.query.isFetchingNextPage}
		errorMessage={history.query.isError && history.rows.length === 0
			? "Couldn't load payouts"
			: undefined}
		onRetry={() => void history.query.refetch()}
		{empty}
		selectedRowId={history.openId}
		onRowClick={history.toggle}
		rowContextMenu
		hasMore={history.query.hasNextPage}
		loadingMore={history.query.isFetchingNextPage}
		onLoadMore={() => void history.query.fetchNextPage()}
	/>
</ResourceRowContextMenu>

<PayoutDetailsPanel
	payout={history.openPayout}
	retiredLabel={RETIRED_MACHINE_LABEL}
	onClose={history.close}
/>
