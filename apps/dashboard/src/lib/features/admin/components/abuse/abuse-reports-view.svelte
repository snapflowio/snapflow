<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const DUE_CLOCK_TICK_MILLISECONDS = 60_000;
const DECIDED_LABEL = 'Decided';
const OVERDUE_TIMESTAMP_CLASS = 'text-(--warning)';
</script>

<script lang="ts">
import type { AbuseReport } from '@snapflow/api-client';
import { renderSnippet } from '@tanstack/svelte-table';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
import ResourceRowContextMenu from '#lib/components/resource/resource-row-context-menu.svelte';
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import CellContent from '#lib/components/resource/table/cell-content.svelte';
import { renderResourceLabel } from '#lib/components/resource/table/resource-cell.ts';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import { resourceColumnHelper } from '#lib/components/resource/table/resource-table-model.ts';
import {
	copyableCell,
	timestampCell,
} from '#lib/components/resource/table/rich-cells.ts';
import TableFooter from '#lib/components/resource/table/table-footer.svelte';
import Timestamp from '#lib/components/ui/timestamp.svelte';
import AdminTableEmpty from '#lib/features/admin/components/shared/admin-table-empty.svelte';
import AdminToolbar from '#lib/features/admin/components/shared/admin-toolbar.svelte';
import {
	ABUSE_REPORT_CATEGORY_LABEL,
	ABUSE_REPORTER_TYPE_LABEL,
	isDecidedReport,
	isOverdueReport,
	reportTarget,
} from '#lib/features/admin/lib/abuse-reports-list.ts';
import {
	GROW_COLUMN,
	NAME_COLUMN,
	STATUS_COLUMN,
	TAG_COLUMN,
	TIME_COLUMN,
} from '#lib/features/admin/lib/admin-columns.ts';
import { adminTableError } from '#lib/features/admin/lib/admin-load-error.ts';
import { AbuseReportsList } from '#lib/features/admin/state/abuse-reports-list.svelte.ts';
import type { AdminViewSwitch } from '#lib/features/admin/state/admin-view-param.svelte.ts';
import { Clock } from '#lib/utils/clock.svelte.ts';
import { countLabel } from '#lib/utils/format.ts';

interface AbuseReportsViewProps {
	title: string;
	viewSwitch: AdminViewSwitch;
}

let { title, viewSwitch }: AbuseReportsViewProps = $props();

const list = new AbuseReportsList();
const clock = new Clock(DUE_CLOCK_TICK_MILLISECONDS);

const column = resourceColumnHelper<AbuseReport>();
const columns = [
	column.accessor((report) => ABUSE_REPORT_CATEGORY_LABEL[report.category], {
		id: 'category',
		header: 'Category',
		meta: NAME_COLUMN,
		cell: ({ row, getValue }) =>
			renderResourceLabel({
				label: getValue(),
				sublabel: ABUSE_REPORTER_TYPE_LABEL[row.original.reporterType],
			}),
	}),
	column.accessor(reportTarget, {
		id: 'target',
		header: 'Reported',
		meta: GROW_COLUMN,
		cell: ({ row, getValue }) =>
			renderResourceLabel({
				label: getValue(),
				sublabel: row.original.hostname ?? undefined,
			}),
	}),
	column.accessor('status', {
		id: 'status',
		header: 'Status',
		meta: STATUS_COLUMN,
		cell: ({ row }) => renderSnippet(statusCell, row.original),
	}),
	column.accessor('createdAt', {
		id: 'received',
		header: 'Received',
		meta: { ...TIME_COLUMN, visibleFrom: 'lg' },
		cell: ({ getValue }) => timestampCell(getValue()),
	}),
	column.accessor('dueAt', {
		id: 'due',
		header: 'Due',
		meta: TIME_COLUMN,
		cell: ({ row }) => renderSnippet(dueCell, row.original),
	}),
	column.accessor((report) => report.abuseCaseId ?? '', {
		id: 'case',
		header: 'Case',
		meta: { ...TAG_COLUMN, visibleFrom: 'xl' },
		cell: ({ row }) => copyableCell(row.original.abuseCaseId, 'Copy case ID'),
	}),
	column.display({
		id: 'actions',
		header: 'Actions',
		meta: { variant: 'actions' },
		cell: ({ row }) => renderSnippet(actionsCell, row.original),
	}),
];
</script>

{#snippet statusCell(report: AbuseReport)}
	<ResourceStateBadge state={report.status} />
{/snippet}

{#snippet dueCell(report: AbuseReport)}
	{#if isDecidedReport(report)}
		<CellContent cell={{ label: DECIDED_LABEL }} data={undefined} />
	{:else}
		<Timestamp
			value={report.dueAt}
			class={isOverdueReport(report, clock.now)
				? OVERDUE_TIMESTAMP_CLASS
				: undefined}
		/>
	{/if}
{/snippet}

{#snippet actionsCell(report: AbuseReport)}
	<ResourceRowActions
		label={`Abuse report ${report.id} actions`}
		actions={list.reportActions(report)}
	/>
{/snippet}

{#snippet emptyState()}
	<AdminTableEmpty
		message="No abuse reports"
		resource="reports"
		search={list.controls.search.value}
		filterCount={list.controls.filterCount}
		onClear={list.controls.clearSearchAndFilters}
	/>
{/snippet}

<AdminToolbar
	{title}
	{viewSwitch}
	controls={list.controls}
	searchPlaceholder="Search abuse reports"
/>
<ResourceRowContextMenu
	actionsFor={(rowId) => (rowId === null ? [] : list.reportRowActions(rowId))}
>
	<ResourceDataTable
		caption="Abuse reports"
		{columns}
		data={list.reports}
		getRowId={(report) => report.id}
		rowLabel={(report) => reportTarget(report)}
		rowDimmed={isDecidedReport}
		sort={list.controls.sort}
		sortConfig={list.controls.sortConfig}
		isLoading={list.reportsQuery.isLoading}
		isFetching={list.reportsQuery.isRefetching}
		errorMessage={adminTableError(list.reportsQuery.error, 'abuse reports')}
		empty={emptyState}
		onRetry={() => void list.reportsQuery.refetch()}
		onRowClick={list.openReport}
		rowContextMenu
	/>
</ResourceRowContextMenu>
<TableFooter label={countLabel(list.reports.length, 'report')} />
