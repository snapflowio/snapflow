<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const ACCOUNT_CHANGES_LABEL = 'Account changes';
</script>

<script lang="ts">
import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
import Copy from '@lucide/svelte/icons/copy';
import Download from '@lucide/svelte/icons/download';
import ExternalLink from '@lucide/svelte/icons/external-link';
import { type EscrowEvent, SettlementParty } from '@snapflow/api-client';
import { createInfiniteQuery, keepPreviousData } from '@tanstack/svelte-query';
import { getPublicConfig } from '#lib/api/public-config.ts';
import { escrowEventsInfiniteQueryOptions } from '#lib/api/settlement/escrow.ts';
import EmptyState from '#lib/components/empty-state.svelte';
import ResourceFilterChips from '#lib/components/resource/filter/resource-filter-chips.svelte';
import ResourceFilterPanel from '#lib/components/resource/filter/resource-filter-panel.svelte';
import ResourceFilterToggle from '#lib/components/resource/filter/resource-filter-toggle.svelte';
import ResourceDetailsPanel from '#lib/components/resource/resource-details-panel.svelte';
import ResourceHeader from '#lib/components/resource/resource-header.svelte';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import ResourceViewSwitch from '#lib/components/resource/resource-view-switch.svelte';
import TableFooter from '#lib/components/resource/table/table-footer.svelte';
import { copyWithToast } from '#lib/components/ui/clipboard/copy-with-toast.ts';
import {
	HISTORY_RECORD_PARAM,
	HISTORY_SEGMENTS,
	HistoryView,
	historySearchSchema,
} from '#lib/features/billing/lib/billing-history.ts';
import {
	CUSTOMER_MONEY_EVENT_KINDS,
	escrowEventLabel,
	escrowEventMonth,
} from '#lib/features/billing/lib/escrow-event.ts';
import {
	CURSOR_PAGE_SIZE,
	cursorPageItems,
	nextCursorPage,
} from '#lib/features/billing/lib/infinite-cursor.ts';
import {
	RECEIPT_FORMATS,
	ReceiptDownload,
} from '#lib/features/billing/state/receipt-download.svelte.ts';
import {
	explorerName,
	explorerTransactionUrl,
	openExplorer,
} from '#lib/features/wallet/lib/explorer.ts';
import { OpenRowParam } from '#lib/routing/open-row-param.svelte.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
import { pluralize } from '#lib/utils/text.ts';
import EscrowEventsTable from '../payments/escrow-events-table.svelte';
import EscrowEventDetails from './escrow-event-details.svelte';
import StatementsList from './statements-list.svelte';

const party = SettlementParty.Customer;
const { chainId } = getPublicConfig().settlement;
const params = new SearchParams(historySearchSchema);
const view = $derived(params.current.view);
const accountChanges = $derived(params.current.changes);
const receipts = new ReceiptDownload();
const [pdfReceipt] = RECEIPT_FORMATS;

const events = createInfiniteQuery(() => ({
	...escrowEventsInfiniteQueryOptions({
		limit: CURSOR_PAGE_SIZE,
		role: party,
		kind: accountChanges ? undefined : [...CUSTOMER_MONEY_EVENT_KINDS],
	}),
	initialPageParam: {},
	getNextPageParam: nextCursorPage,
	placeholderData: keepPreviousData,
	enabled: view === HistoryView.Transactions,
}));
const rows = $derived(cursorPageItems(events.data));
const panel = new OpenRowParam(
	() => rows,
	(event) => event.id,
	{ param: HISTORY_RECORD_PARAM, closeWithBack: true }
);

function rowActions(event: EscrowEvent): ResourceRowAction[] {
	const href = explorerTransactionUrl(chainId, event.transactionHash);
	const month = escrowEventMonth(event);
	return [
		{
			label: 'Copy hash',
			icon: Copy,
			onSelect: () => void copyWithToast(event.transactionHash, 'hash'),
		},
		{
			label: `View on ${explorerName(chainId)}`,
			icon: ExternalLink,
			visible: href !== null,
			onSelect: () => {
				if (href) openExplorer(href);
			},
		},
		{
			label: pdfReceipt.label,
			icon: Download,
			visible: receipts.available,
			disabledReason: receipts.disabledReason(month),
			onSelect: () => receipts.download(month, pdfReceipt.format),
		},
	];
}

function changeView(next: string): void {
	const segment = HISTORY_SEGMENTS.find((each) => each.value === next);
	if (segment) void params.update({ view: segment.value });
}
</script>

{#snippet filterPanel()}
	<ResourceFilterPanel>
		<ResourceFilterToggle
			label={ACCOUNT_CHANGES_LABEL}
			checked={accountChanges}
			onCheckedChange={(changes) =>
				void params.update({ changes: changes || undefined })}
		/>
	</ResourceFilterPanel>
{/snippet}

{#snippet appliedFilters()}
	{#if view === HistoryView.Transactions && accountChanges}
		<div class="flex min-w-0 items-center gap-2 overflow-x-auto max-md:hidden">
			<ResourceFilterChips
				filterTags={[
					{
						field: ACCOUNT_CHANGES_LABEL,
						value: 'Shown',
						onRemove: () => void params.update({ changes: undefined }),
					},
				]}
			/>
		</div>
	{/if}
{/snippet}

{#snippet toolbar()}
	<ResourceViewSwitch
		aria-label="History view"
		options={HISTORY_SEGMENTS}
		value={view}
		onChange={changeView}
	/>
{/snippet}

{#snippet empty()}
	<EmptyState
		icon={ArrowLeftRight}
		bordered={false}
		title="No transactions yet"
	>
		<p>Deposits, withdrawals and automatic payments show up here.</p>
	</EmptyState>
{/snippet}

<ResourceHeader
	title="History"
	status={appliedFilters}
	filter={view === HistoryView.Transactions
		? { active: accountChanges, content: filterPanel }
		: undefined}
	trailing={toolbar}
/>
{#if view === HistoryView.Transactions}
	<div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
		<div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
			<EscrowEventsTable
				caption="Transactions"
				events={rows}
				{party}
				errorMessage={events.isError ? "Couldn't load transactions" : undefined}
				isLoading={events.isLoading}
				isFetching={events.isFetching}
				onRetry={() => void events.refetch()}
				{empty}
				emptyMessage="No transactions yet"
				hasMore={events.hasNextPage}
				loadingMore={events.isFetchingNextPage}
				onLoadMore={() => void events.fetchNextPage()}
				selectedRowId={panel.openId}
				onRowClick={panel.open}
				{rowActions}
			/>
		</div>
		{#if events.isSuccess && rows.length > 0}
			<TableFooter>
				{`${pluralize(rows.length, 'entry', 'entries')}${events.hasNextPage ? '+' : ''}`}
			</TableFooter>
		{/if}
		<ResourceDetailsPanel
			open={panel.row !== null}
			title={panel.row ? escrowEventLabel(panel.row, party) : 'Transaction'}
			onClose={panel.close}
			onPrevious={panel.previous}
			onNext={panel.next}
		>
			{#if panel.row}
				{#key panel.row.id}
					<EscrowEventDetails escrowEvent={panel.row} {party} />
				{/key}
			{/if}
		</ResourceDetailsPanel>
	</div>
{:else}
	<StatementsList {receipts} />
{/if}
