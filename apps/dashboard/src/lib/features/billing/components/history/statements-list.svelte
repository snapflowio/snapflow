<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { BillingStatementSummary } from '@snapflow/api-client';
import { renderSnippet } from '@tanstack/svelte-table';
import { resourceTextCell } from '#lib/components/resource/table/resource-cells.ts';
import { resourceColumnHelper } from '#lib/components/resource/table/resource-table-model.ts';

const STATEMENT_PARAM = 'statement';
const PERIOD_COLUMN_GROW = 1;
const DATES_COLUMN_GROW = 2;
const STATUS_COLUMN_WIDTH = 136;
const column = resourceColumnHelper<BillingStatementSummary>();
</script>

<script lang="ts">
import Download from '@lucide/svelte/icons/download';
import FileText from '@lucide/svelte/icons/file-text';
import { ClientPagination } from '#lib/components/resource/resource-client-pagination.svelte.ts';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import StatementDetailsModal from '#lib/features/billing/components/details/statement-details-modal.svelte';
import {
	formatStatementMonth,
	formatStatementPeriod,
} from '#lib/features/billing/lib/format.ts';
import {
	RECEIPT_FORMATS,
	type ReceiptDownload,
} from '#lib/features/billing/state/receipt-download.svelte.ts';
import { OpenRowParam } from '#lib/routing/open-row-param.svelte.ts';
import { Path } from '#lib/routing/paths.ts';
import { pluralize } from '#lib/utils/text.ts';
import { resolve } from '$app/paths';

interface StatementsListProps {
	receipts: ReceiptDownload;
}

let { receipts }: StatementsListProps = $props();

const statements = $derived(receipts.statements);
const rows = $derived(statements.data ?? []);
const needsDetails = $derived(
	receipts.available && receipts.profile.isSuccess && !receipts.hasDetails
);
const pages = new ClientPagination(
	() => rows,
	() => rows.length
);
const panel = new OpenRowParam(
	() => rows,
	(statement) => statement.month,
	{ param: STATEMENT_PARAM, closeWithBack: true }
);

function actionsFor(statement: BillingStatementSummary): ResourceRowAction[] {
	return [
		{
			label: 'Open statement',
			icon: FileText,
			onSelect: () => panel.open(statement.month),
		},
		...RECEIPT_FORMATS.map((option) => ({
			label: option.label,
			icon: Download,
			visible: receipts.available,
			disabledReason: receipts.disabledReason(statement.month),
			onSelect: () => receipts.download(statement.month, option.format),
		})),
	];
}

const columns = [
	column.accessor('month', {
		id: 'period',
		header: 'Period',
		meta: { grow: PERIOD_COLUMN_GROW },
		cell: ({ getValue }) =>
			resourceTextCell({ label: formatStatementMonth(getValue()) }),
	}),
	column.display({
		id: 'dates',
		header: 'Dates',
		meta: { grow: DATES_COLUMN_GROW },
		cell: ({ row }) =>
			resourceTextCell({
				label: `${formatStatementPeriod(row.original.periodStart, row.original.periodEnd)} UTC`,
			}),
	}),
	column.accessor('open', {
		id: 'status',
		header: 'Status',
		meta: { width: STATUS_COLUMN_WIDTH, compact: true },
		cell: ({ row }) => renderSnippet(statusCell, row.original),
	}),
	column.display({
		id: 'actions',
		header: 'Actions',
		meta: { variant: 'actions' },
		cell: ({ row }) => renderSnippet(actionsCell, row.original),
	}),
];
</script>

{#snippet statusCell(statement: BillingStatementSummary)}
	<Badge size="sm" variant={statement.open ? 'neutral' : 'success'}>
		{statement.open ? 'In progress' : 'Closed'}
	</Badge>
{/snippet}

{#snippet actionsCell(statement: BillingStatementSummary)}
	<ResourceRowActions
		label={`Actions for the ${formatStatementMonth(statement.month)} statement`}
		actions={actionsFor(statement)}
	/>
{/snippet}

{#snippet addDetails()}
	<Chip
		size="compact"
		variant="secondary"
		href={resolve(Path.SETTINGS_BILLING)}
	>
		Add details
	</Chip>
{/snippet}

<div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
	{#if needsDetails}
		<div class="p-4">
			<Notice
				title="Add billing details to download receipts"
				action={addDetails}
			/>
		</div>
	{/if}
	<ResourceDataTable
		caption="Statements"
		{columns}
		data={pages.rows}
		getRowId={(statement) => statement.month}
		rowLabel={(statement) =>
			`Open the ${formatStatementMonth(statement.month)} statement`}
		selectedRowId={panel.openId}
		onRowClick={panel.open}
		isLoading={statements.isLoading}
		isFetching={statements.isFetching}
		errorMessage={statements.isError ? "Couldn't load statements" : undefined}
		onRetry={() => void statements.refetch()}
		emptyMessage="No statements yet"
		emptyIcon={FileText}
		pagination={rows.length > 0 ? pages.config : undefined}
		footer={rows.length > 0 ? pluralize(rows.length, 'statement') : undefined}
	/>
</div>
<StatementDetailsModal month={panel.openId} onClose={panel.close} />
