<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { RefundDue } from '@snapflow/api-client';
import { renderSnippet } from '@tanstack/svelte-table';
import Resource from '#lib/components/resource/resource.svelte';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
import ResourceRowContextMenu from '#lib/components/resource/resource-row-context-menu.svelte';
import { renderResourceLabel } from '#lib/components/resource/table/resource-cell.ts';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import { resourceColumnHelper } from '#lib/components/resource/table/resource-table-model.ts';
import {
	addressCell,
	moneyCell,
	timestampCell,
} from '#lib/components/resource/table/rich-cells.ts';
import TableFooter from '#lib/components/resource/table/table-footer.svelte';
import AdminTableEmpty from '#lib/features/admin/components/shared/admin-table-empty.svelte';
import AdminToolbar from '#lib/features/admin/components/shared/admin-toolbar.svelte';
import {
	GROW_COLUMN,
	MONEY_COLUMN,
	NAME_COLUMN,
	TIME_COLUMN,
} from '#lib/features/admin/lib/admin-columns.ts';
import { adminTableError } from '#lib/features/admin/lib/admin-load-error.ts';
import { RefundsList } from '#lib/features/admin/state/refunds-list.svelte.ts';
import { countLabel } from '#lib/utils/format.ts';
import RecordRefundModal from './record-refund-modal.svelte';

const list = new RefundsList();

const column = resourceColumnHelper<RefundDue>();
const columns = [
	column.accessor('customerOrganizationName', {
		id: 'customer',
		header: 'Customer',
		meta: NAME_COLUMN,
		cell: ({ row }) =>
			renderResourceLabel({
				label: row.original.customerOrganizationName,
			}),
	}),
	column.accessor('customerAddress', {
		id: 'wallet',
		header: 'Wallet',
		meta: GROW_COLUMN,
		cell: ({ getValue }) => addressCell(getValue()),
	}),
	column.accessor((refund) => BigInt(refund.dueMicroUsd), {
		id: 'due',
		header: 'Due',
		meta: MONEY_COLUMN,
		cell: ({ row }) => moneyCell(row.original.dueMicroUsd),
	}),
	column.accessor((refund) => BigInt(refund.refundedMicroUsd), {
		id: 'refunded',
		header: 'Refunded',
		meta: MONEY_COLUMN,
		cell: ({ row }) => moneyCell(row.original.refundedMicroUsd),
	}),
	column.accessor('endedAt', {
		id: 'ended',
		header: 'Ended',
		meta: { ...TIME_COLUMN, visibleFrom: 'lg' },
		cell: ({ row }) => timestampCell(row.original.endedAt),
	}),
	column.display({
		id: 'actions',
		header: 'Actions',
		meta: { variant: 'actions' },
		cell: ({ row }) => renderSnippet(actionsCell, row.original),
	}),
];
</script>

{#snippet actionsCell(refund: RefundDue)}
	<ResourceRowActions
		label={`${refund.customerOrganizationName} refund actions`}
		actions={list.refundActions(refund)}
	/>
{/snippet}

{#snippet emptyState()}
	<AdminTableEmpty
		message="No refunds due"
		resource="refunds"
		search={list.controls.search.value}
		onClear={list.controls.clearSearchAndFilters}
	/>
{/snippet}

<Resource>
	<AdminToolbar
		title="Refunds"
		controls={list.controls}
		searchPlaceholder="Search refunds"
	/>
	<ResourceRowContextMenu
		actionsFor={(rowId) => (rowId === null ? [] : list.refundRowActions(rowId))}
	>
		<ResourceDataTable
			caption="Refunds due"
			{columns}
			data={list.refunds}
			getRowId={(refund) => refund.paymentChannelId}
			rowLabel={(refund) => refund.customerOrganizationName}
			sort={list.controls.sort}
			sortConfig={list.controls.sortConfig}
			isLoading={list.refundsQuery.isLoading}
			isFetching={list.refundsQuery.isRefetching}
			errorMessage={adminTableError(list.refundsQuery.error, 'refunds')}
			empty={emptyState}
			onRetry={() => void list.refundsQuery.refetch()}
			rowContextMenu
		/>
	</ResourceRowContextMenu>
	<TableFooter label={countLabel(list.refunds.length, 'refund')} />
</Resource>
<RecordRefundModal
	refund={list.recording}
	pending={list.record.isPending}
	onRecord={list.confirmRecord}
	onClose={list.close}
/>
