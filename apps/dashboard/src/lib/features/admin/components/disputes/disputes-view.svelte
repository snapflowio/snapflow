<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import CircleAlert from '@lucide/svelte/icons/circle-alert';
import type { AdminPaymentDispute } from '@snapflow/api-client';
import { renderSnippet } from '@tanstack/svelte-table';
import Resource from '#lib/components/resource/resource.svelte';
import ResourceDetailsPanel from '#lib/components/resource/resource-details-panel.svelte';
import ResourceHeader from '#lib/components/resource/resource-header.svelte';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import { renderResourceLabel } from '#lib/components/resource/table/resource-cell.ts';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import { resourceColumnHelper } from '#lib/components/resource/table/resource-table-model.ts';
import { timeCell } from '#lib/components/resource/table/time-cell.ts';
import AdminListEmpty from '#lib/features/admin/components/admin-list-empty.svelte';
import AdminListOptionsBar from '#lib/features/admin/components/admin-list-options-bar.svelte';
import AdminRecordDetails from '#lib/features/admin/components/admin-record-details.svelte';
import AdminTableContextMenu from '#lib/features/admin/components/admin-table-context-menu.svelte';
import { adminTableErrorProps } from '#lib/features/admin/components/admin-table-error.svelte';
import { DisputesList } from '#lib/features/admin/state/disputes-list.svelte.ts';
import { formatDateTime } from '#lib/utils/format.ts';
import { titleCase } from '#lib/utils/text.ts';
import { formatCents, formatUsd } from '#lib/utils/usd.ts';

const list = new DisputesList();
const panel = list.panel;

const column = resourceColumnHelper<AdminPaymentDispute>();
const columns = [
	column.accessor('organizationId', {
		id: 'organization',
		header: 'Organization',
		cell: ({ row }) =>
			renderResourceLabel({
				icon: alertIcon,
				label: row.original.organizationId,
				sublabel: row.original.stripeDisputeId,
			}),
	}),
	column.accessor('amountCents', {
		id: 'amount',
		header: 'Amount',
		cell: ({ getValue }) =>
			renderResourceLabel({ label: formatCents(getValue()) }),
	}),
	column.accessor((dispute) => formatUsd(dispute.frozenMicroUsd), {
		id: 'frozen',
		header: 'Credit frozen',
		cell: ({ getValue }) => renderResourceLabel({ label: getValue() }),
	}),
	column.accessor('state', {
		id: 'state',
		header: 'State',
		cell: ({ row }) => renderSnippet(stateCell, row.original),
	}),
	column.accessor((dispute) => titleCase(dispute.reason), {
		id: 'reason',
		header: 'Reason',
		cell: ({ getValue }) => renderResourceLabel({ label: getValue() }),
	}),
	column.accessor((dispute) => dispute.evidenceDueBy ?? '', {
		id: 'evidenceDue',
		header: 'Evidence due',
		cell: ({ row }) =>
			renderResourceLabel(timeCell(row.original.evidenceDueBy)),
	}),
	column.accessor('createdAt', {
		id: 'created',
		header: 'Opened',
		cell: ({ getValue }) => renderResourceLabel(timeCell(getValue())),
	}),
	column.display({
		id: 'actions',
		header: 'Actions',
		meta: { variant: 'actions' },
		cell: ({ row }) => renderSnippet(actionsCell, row.original),
	}),
];
</script>

{#snippet alertIcon()}
	<CircleAlert />
{/snippet}

{#snippet stateCell(
	dispute: AdminPaymentDispute
)}
	<ResourceStateBadge state={dispute.state} />
{/snippet}

{#snippet actionsCell(
	dispute: AdminPaymentDispute
)}
	<ResourceRowActions
		label={`Dispute ${dispute.stripeDisputeId} actions`}
		actions={list.disputeActions(dispute)}
	/>
{/snippet}

{#snippet emptyState()}
	<AdminListEmpty
		search={list.controls.search.value}
		filterCount={list.controls.filterTags.length}
		onClear={list.controls.clearSearchAndFilters}
		title="Disputes"
		description="Chargebacks opened against top-ups appear here with the credit they froze."
	/>
{/snippet}

{#snippet detailsPanel()}
	<ResourceDetailsPanel
		open={panel.row !== null}
		title="Dispute details"
		onClose={panel.close}
		onPrevious={panel.previous}
		onNext={panel.next}
	>
		{#if panel.row}
			{const dispute = $derived(panel.row)}
			<AdminRecordDetails
				summary={[
					{ label: 'Opened', value: formatDateTime(dispute.createdAt) },
					{ label: 'Amount', value: formatCents(dispute.amountCents) },
				]}
				fields={[
					{
						label: 'Stripe dispute',
						value: dispute.stripeDisputeId,
						mono: true,
					},
					{
						label: 'Organization',
						value: dispute.organizationId,
						mono: true,
					},
					{ label: 'Top-up', value: dispute.topUpId, mono: true },
					{ label: 'State', content: disputeState },
					{ label: 'Reason', value: titleCase(dispute.reason) },
					{ label: 'Credit frozen', value: formatUsd(dispute.frozenMicroUsd) },
					{
						label: 'Evidence due',
						value: dispute.evidenceDueBy
							? formatDateTime(dispute.evidenceDueBy)
							: null,
					},
					{
						label: 'Closed',
						value: dispute.closedAt ? formatDateTime(dispute.closedAt) : null,
					},
				]}
			/>
			{#snippet disputeState()}
				<ResourceStateBadge state={dispute.state} />
			{/snippet}
		{/if}
	</ResourceDetailsPanel>
{/snippet}

<Resource>
	<ResourceHeader icon={CircleAlert} title="Disputes" />
	<AdminListOptionsBar
		controls={list.controls}
		placeholder="Search disputes..."
		ariaLabel="Search disputes"
	/>
	<AdminTableContextMenu rowActions={list.disputeRowActions}>
		<ResourceDataTable
			caption="Disputes"
			{columns}
			data={list.disputes}
			getRowId={(dispute) => dispute.id}
			rowLabel={(dispute) => `Dispute ${dispute.stripeDisputeId}`}
			sort={list.controls.sort}
			selectedRowId={panel.openId}
			isLoading={list.disputesQuery.isLoading}
			empty={emptyState}
			onRetry={() => void list.disputesQuery.refetch()}
			onRowClick={panel.open}
			onRowContextMenu={() => {}}
			hasMore={list.disputesQuery.hasNextPage}
			loadingMore={list.disputesQuery.isFetchingNextPage}
			onLoadMore={() => void list.disputesQuery.fetchNextPage()}
			overlay={detailsPanel}
			{...adminTableErrorProps(
				list.disputesQuery.error,
				'Failed to load disputes'
			)}
		/>
	</AdminTableContextMenu>
</Resource>
