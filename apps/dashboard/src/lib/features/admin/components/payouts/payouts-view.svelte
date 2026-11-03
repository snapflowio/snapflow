<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import RotateCw from '@lucide/svelte/icons/rotate-cw';
import type { Payout } from '@snapflow/api-client';
import { renderSnippet } from '@tanstack/svelte-table';
import Credit from '#lib/components/icons/credit.svelte';
import Resource from '#lib/components/resource/resource.svelte';
import ResourceDetailsPanel from '#lib/components/resource/resource-details-panel.svelte';
import ResourceHeader from '#lib/components/resource/resource-header.svelte';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import { renderResourceLabel } from '#lib/components/resource/table/resource-cell.ts';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import { resourceColumnHelper } from '#lib/components/resource/table/resource-table-model.ts';
import { timeCell } from '#lib/components/resource/table/time-cell.ts';
import IconButton from '#lib/components/ui/icon-button.svelte';
import AdminListEmpty from '#lib/features/admin/components/admin-list-empty.svelte';
import AdminListOptionsBar from '#lib/features/admin/components/admin-list-options-bar.svelte';
import AdminRecordDetails from '#lib/features/admin/components/admin-record-details.svelte';
import AdminTableContextMenu from '#lib/features/admin/components/admin-table-context-menu.svelte';
import { adminTableErrorProps } from '#lib/features/admin/components/admin-table-error.svelte';
import { isRetryable } from '#lib/features/admin/lib/payouts-list.ts';
import { PayoutsList } from '#lib/features/admin/state/payouts-list.svelte.ts';
import { formatDateTime } from '#lib/utils/format.ts';
import { formatCents } from '#lib/utils/usd.ts';

const list = new PayoutsList();
const panel = list.panel;

const column = resourceColumnHelper<Payout>();
const columns = [
	column.accessor('organizationId', {
		id: 'organization',
		header: 'Organization',
		cell: ({ row }) =>
			renderResourceLabel({
				icon: creditIcon,
				label: row.original.organizationId,
				sublabel: row.original.batchId,
			}),
	}),
	column.accessor('amountCents', {
		id: 'amount',
		header: 'Amount',
		cell: ({ getValue }) =>
			renderResourceLabel({ label: formatCents(getValue()) }),
	}),
	column.accessor('state', {
		id: 'state',
		header: 'State',
		cell: ({ row }) => renderSnippet(stateCell, row.original),
	}),
	column.accessor((payout) => payout.stripeTransferId ?? '', {
		id: 'transfer',
		header: 'Stripe transfer',
		cell: ({ getValue }) => renderResourceLabel({ label: getValue() || null }),
	}),
	column.accessor('createdAt', {
		id: 'created',
		header: 'Created',
		cell: ({ getValue }) => renderResourceLabel(timeCell(getValue())),
	}),
	column.accessor((payout) => payout.transferredAt ?? '', {
		id: 'transferred',
		header: 'Transferred',
		cell: ({ row }) =>
			renderResourceLabel(timeCell(row.original.transferredAt)),
	}),
	column.display({
		id: 'actions',
		header: 'Actions',
		meta: { variant: 'actions' },
		cell: ({ row }) => renderSnippet(actionsCell, row.original),
	}),
];
</script>

{#snippet creditIcon()}
	<Credit />
{/snippet}

{#snippet stateCell(
	payout: Payout
)}
	<ResourceStateBadge state={payout.state} errorReason={payout.failureReason} />
{/snippet}

{#snippet actionsCell(
	payout: Payout
)}
	<ResourceRowActions
		label={`Payout ${payout.id} actions`}
		actions={list.payoutActions(payout)}
	/>
{/snippet}

{#snippet emptyState()}
	<AdminListEmpty
		search={list.controls.search.value}
		filterCount={list.controls.filterTags.length}
		onClear={list.controls.clearSearchAndFilters}
		title="Payouts"
		description="Transfers of host earnings to Stripe accounts appear here."
	/>
{/snippet}

{#snippet panelActions()}
	{#if panel.row && isRetryable(panel.row)}
		{const payout = $derived(panel.row)}
		<IconButton
			variant="ghost"
			label="Retry transfer"
			icon={RotateCw}
			disabled={list.retry.isPending}
			onclick={() => list.retry.mutate(payout.id)}
		/>
	{/if}
{/snippet}

{#snippet detailsPanel()}
	<ResourceDetailsPanel
		open={panel.row !== null}
		title="Payout details"
		onClose={panel.close}
		onPrevious={panel.previous}
		onNext={panel.next}
		actions={panelActions}
	>
		{#if panel.row}
			{const payout = $derived(panel.row)}
			<AdminRecordDetails
				summary={[
					{ label: 'Created', value: formatDateTime(payout.createdAt) },
					{ label: 'Amount', value: formatCents(payout.amountCents) },
				]}
				fields={[
					{ label: 'Payout ID', value: payout.id, mono: true },
					{ label: 'Organization', value: payout.organizationId, mono: true },
					{ label: 'Batch', value: payout.batchId, mono: true },
					{ label: 'State', content: payoutState },
					{
						label: 'Stripe transfer',
						value: payout.stripeTransferId,
						mono: true,
					},
					{
						label: 'Transferred',
						value: payout.transferredAt
							? formatDateTime(payout.transferredAt)
							: null,
					},
				]}
				notes={[{ label: 'Failure reason', value: payout.failureReason }]}
			/>
			{#snippet payoutState()}
				<ResourceStateBadge state={payout.state} />
			{/snippet}
		{/if}
	</ResourceDetailsPanel>
{/snippet}

<Resource>
	<ResourceHeader icon={Credit} title="Payouts" />
	<AdminListOptionsBar
		controls={list.controls}
		placeholder="Search payouts..."
		ariaLabel="Search payouts"
	/>
	<AdminTableContextMenu rowActions={list.payoutRowActions}>
		<ResourceDataTable
			caption="Payouts"
			{columns}
			data={list.payouts}
			getRowId={(payout) => payout.id}
			rowLabel={(payout) => `Payout ${payout.id}`}
			sort={list.controls.sort}
			selectedRowId={panel.openId}
			isLoading={list.payoutsQuery.isLoading}
			empty={emptyState}
			onRetry={() => void list.payoutsQuery.refetch()}
			onRowClick={panel.open}
			onRowContextMenu={() => {}}
			hasMore={list.payoutsQuery.hasNextPage}
			loadingMore={list.payoutsQuery.isFetchingNextPage}
			onLoadMore={() => void list.payoutsQuery.fetchNextPage()}
			overlay={detailsPanel}
			{...adminTableErrorProps(
				list.payoutsQuery.error,
				'Failed to load payouts'
			)}
		/>
	</AdminTableContextMenu>
</Resource>
