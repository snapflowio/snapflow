<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { BillingSandboxUsageDto } from '@snapflow/api-client';
import { renderSnippet } from '@tanstack/svelte-table';
import { EMPTY_CELL_PLACEHOLDER } from '#lib/components/resource/table/resource-table.ts';
import { resourceColumnHelper } from '#lib/components/resource/table/resource-table-model.ts';

const column = resourceColumnHelper<BillingSandboxUsageDto>();
const NAME_COLUMN_GROW = 2;
const SHARE_COLUMN_WIDTH = 136;
const TOTAL_COLUMN_WIDTH = 104;
const PREVIOUS_MONTH = -1;
const NEXT_MONTH = 1;
</script>

<script lang="ts">
import ChevronLeft from '@lucide/svelte/icons/chevron-left';
import ChevronRight from '@lucide/svelte/icons/chevron-right';
import Gauge from '@lucide/svelte/icons/gauge';
import EmptyState from '#lib/components/empty-state.svelte';
import TerminalWindow from '#lib/components/icons/terminal-window.svelte';
import ResourceDetailsPanel from '#lib/components/resource/resource-details-panel.svelte';
import ResourceHeader from '#lib/components/resource/resource-header.svelte';
import { resourceCell } from '#lib/components/resource/table/resource-cells.ts';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import TableFooter from '#lib/components/resource/table/table-footer.svelte';
import IconButton from '#lib/components/ui/icon-button.svelte';
import Money from '#lib/components/ui/money.svelte';
import UsageExport from '#lib/features/billing/components/usage-export.svelte';
import UsagePeriodPicker from '#lib/features/billing/components/usage-period-picker.svelte';
import { BILLING_EVIDENCE_PENDING_LABEL as VERIFYING_LABEL } from '#lib/features/billing/lib/billing-evidence.ts';
import {
	DELETED_SANDBOX_LABEL,
	sandboxUsageSharePercent,
	sandboxUsageTitle,
} from '#lib/features/billing/lib/billing-usage.ts';
import {
	BILLING_USAGE_PERIOD_OPTIONS,
	CALENDAR_MONTH_PERIOD,
} from '#lib/features/billing/lib/billing-usage-period.ts';
import { USAGE_PERIOD } from '#lib/features/billing/lib/usage-period.ts';
import { SandboxUsageList } from '#lib/features/billing/state/sandbox-usage-list.svelte.ts';
import { pluralize } from '#lib/utils/text.ts';
import SandboxUsageChargesView from './sandbox-usage-charges-view.svelte';

const list = new SandboxUsageList();
const query = list.query;
const openRow = $derived(
	list.usage.find((row) => row.sandboxId === list.panel.openId) ?? null
);
const emptyMessage = $derived(
	list.calendarMonth ? 'No usage for this month' : 'No usage in this period'
);
const countLabel = $derived(
	`${pluralize(list.usage.length, 'sandbox', 'sandboxes')}${query.hasNextPage ? '+' : ''}`
);

function sublabel(row: BillingSandboxUsageDto): string | undefined {
	if (!row.sandboxName) return DELETED_SANDBOX_LABEL;
	return row.evidence.pending > 0 ? VERIFYING_LABEL : undefined;
}

const columns = [
	column.accessor('sandboxName', {
		id: 'sandbox',
		header: 'Sandbox',
		meta: { grow: NAME_COLUMN_GROW },
		cell: ({ row }) =>
			resourceCell(
				{
					icon: sandboxIcon,
					label: sandboxUsageTitle(row.original),
					sublabel: sublabel(row.original),
				},
				row.original
			),
	}),
	column.display({
		id: 'share',
		header: 'Share',
		meta: { width: SHARE_COLUMN_WIDTH },
		cell: ({ row }) => renderSnippet(shareCell, row.original),
	}),
	column.accessor('totalMicroUsd', {
		id: 'total',
		header: 'Total',
		meta: { width: TOTAL_COLUMN_WIDTH, align: 'end', compact: true },
		cell: ({ row }) => renderSnippet(totalCell, row.original),
	}),
];
</script>

{#snippet sandboxIcon()}
	<TerminalWindow class="size-3.5" />
{/snippet}

{#snippet totalCell(row: BillingSandboxUsageDto)}
	<Money class="text-(--text-primary)" microUsd={row.totalMicroUsd} />
{/snippet}

{#snippet shareCell(row: BillingSandboxUsageDto)}
	{const share = $derived(sandboxUsageSharePercent(row, list.totalMicroUsd))}
	<span class="flex items-center gap-2">
		<span
			aria-hidden="true"
			class="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-surface-5 max-sm:hidden"
		>
			<span
				class="block h-full rounded-full bg-(--accent)"
				style:width={`${share}%`}
			></span>
		</span>
		<span class="w-10 font-mono text-(--text-muted) text-xs tabular-nums"
			>{`${share}%`}</span
		>
	</span>
{/snippet}

{#snippet empty()}
	<EmptyState icon={Gauge} bordered={false} title={emptyMessage}>
		<p>Every sandbox you run shows up here with what it cost.</p>
	</EmptyState>
{/snippet}

{#snippet toolbar()}
	<div class="flex min-w-0 items-center gap-1 sm:gap-2">
		<div class="flex items-center gap-1">
			<IconButton
				variant="ghost"
				size="md"
				label="Previous month"
				icon={ChevronLeft}
				onclick={() => list.stepMonth(PREVIOUS_MONTH)}
			/>
			<span
				class="min-w-20 text-center text-(--text-primary) text-sm tabular-nums"
			>
				{list.calendarMonth ? list.monthLabel : EMPTY_CELL_PLACEHOLDER}
			</span>
			<IconButton
				variant="ghost"
				size="md"
				label="Next month"
				icon={ChevronRight}
				onclick={() => list.stepMonth(NEXT_MONTH)}
			/>
		</div>
		<UsagePeriodPicker
			options={BILLING_USAGE_PERIOD_OPTIONS}
			selection={list.selection}
			onChange={list.select}
		/>
		<UsageExport
			disabled={list.usage.length === 0 || query.isPlaceholderData}
			period={list.selection.period === CALENDAR_MONTH_PERIOD
				? USAGE_PERIOD.CUSTOM
				: list.selection.period}
			range={list.range}
			updatedAt={list.updatedAt}
		/>
	</div>
{/snippet}

<ResourceHeader title="Usage" trailing={toolbar} />
<div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
	<div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
		<ResourceDataTable
			caption="Usage by sandbox"
			{columns}
			data={list.usage}
			getRowId={(row) => row.sandboxId}
			rowLabel={(row) => `Open ${sandboxUsageTitle(row)}`}
			rowDimmed={() => query.isPlaceholderData}
			selectedRowId={list.panel.openId}
			onRowClick={list.panel.open}
			isLoading={query.isLoading}
			isFetching={query.isFetching}
			errorMessage={query.isError ? "Couldn't load usage" : undefined}
			onRetry={() => void query.refetch()}
			{emptyMessage}
			{empty}
			hasMore={query.hasNextPage}
			loadingMore={query.isFetchingNextPage}
			onLoadMore={() => void query.fetchNextPage()}
		/>
	</div>
	{#if query.isSuccess && list.usage.length > 0}
		<TableFooter>
			<span>{countLabel}</span>
			<span aria-hidden="true">·</span>
			<span class="flex items-center gap-1">
				<Money class="text-(--text-primary)" microUsd={list.totalMicroUsd} />
				total
			</span>
		</TableFooter>
	{/if}
	<ResourceDetailsPanel
		open={list.panel.openId !== null}
		title={openRow ? sandboxUsageTitle(openRow) : 'Sandbox usage'}
		width="wide"
		onClose={list.panel.close}
		onPrevious={list.panel.previous}
		onNext={list.panel.next}
	>
		{#if list.panel.openId}
			{#key list.panel.openId}
				<SandboxUsageChargesView
					sandboxId={list.panel.openId}
					range={list.range}
				/>
			{/key}
		{/if}
	</ResourceDetailsPanel>
</div>
