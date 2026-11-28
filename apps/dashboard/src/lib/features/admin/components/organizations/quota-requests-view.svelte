<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Copy from '@lucide/svelte/icons/copy';
import Gauge from '@lucide/svelte/icons/gauge';
import {
	type AdminQuotaIncreaseRequest,
	QuotaIncreaseRequestStatus,
} from '@snapflow/api-client';
import {
	createInfiniteQuery,
	createMutation,
	keepPreviousData,
} from '@tanstack/svelte-query';
import { renderSnippet } from '@tanstack/svelte-table';
import {
	decideQuotaIncreaseRequestMutationOptions,
	quotaIncreaseRequestsInfiniteQueryOptions,
} from '#lib/api/admin/quota-increase-requests.ts';
import PanelSection from '#lib/components/detail/panel-section.svelte';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import ResourceDetailsPanel from '#lib/components/resource/resource-details-panel.svelte';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
import ResourceRowContextMenu from '#lib/components/resource/resource-row-context-menu.svelte';
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import { renderResourceLabel } from '#lib/components/resource/table/resource-cell.ts';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import { resourceColumnHelper } from '#lib/components/resource/table/resource-table-model.ts';
import { timestampCell } from '#lib/components/resource/table/rich-cells.ts';
import TableFooter from '#lib/components/resource/table/table-footer.svelte';
import IconButton from '#lib/components/ui/icon-button.svelte';
import AdminTableEmpty from '#lib/features/admin/components/shared/admin-table-empty.svelte';
import AdminToolbar from '#lib/features/admin/components/shared/admin-toolbar.svelte';
import {
	GROW_COLUMN,
	NAME_COLUMN,
	STATUS_COLUMN,
	TIME_COLUMN,
} from '#lib/features/admin/lib/admin-columns.ts';
import { adminFilter } from '#lib/features/admin/lib/admin-filters.ts';
import {
	ADMIN_PAGE_SIZE,
	adminCursorPages,
	adminPageItems,
	copyId,
	matchesSearch,
} from '#lib/features/admin/lib/admin-list.ts';
import { adminTableError } from '#lib/features/admin/lib/admin-load-error.ts';
import {
	isPendingRequest,
	QUOTA_REQUEST_CLEARED_FILTERS,
	QUOTA_REQUEST_EMPTY_MESSAGES,
	QUOTA_REQUEST_FILTER_KEYS,
	QUOTA_REQUEST_SORT_OPTIONS,
	QUOTA_REQUEST_STATUS_OPTIONS,
	quotaRequestsSearchSchema,
	requestClassLabel,
	requestedLimitsSummary,
	requestStatusFilterValues,
	requestStatusFromFilter,
	showsPendingRequestsOnly,
} from '#lib/features/admin/lib/quota-requests-list.ts';
import { AdminListControls } from '#lib/features/admin/state/admin-list-controls.svelte.ts';
import type { AdminViewSwitch } from '#lib/features/admin/state/admin-view-param.svelte.ts';
import { OpenRowParam } from '#lib/routing/open-row-param.svelte.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
import { countLabel, formatDateTime } from '#lib/utils/format.ts';
import QuotaRequestDecisionModal from './quota-request-decision-modal.svelte';

interface QuotaRequestsViewProps {
	title: string;
	viewSwitch: AdminViewSwitch;
}

let { title, viewSwitch }: QuotaRequestsViewProps = $props();

const params = new SearchParams(quotaRequestsSearchSchema);
const controls = new AdminListControls(params, {
	sortOptions: QUOTA_REQUEST_SORT_OPTIONS,
	filterKeys: QUOTA_REQUEST_FILTER_KEYS,
	clearedFilterValues: QUOTA_REQUEST_CLEARED_FILTERS,
	filterFields: () => [
		adminFilter({
			id: 'status',
			label: 'Status',
			options: QUOTA_REQUEST_STATUS_OPTIONS,
			values: requestStatusFilterValues(params.current.status),
			onChange: (values) =>
				void params.update({ status: requestStatusFromFilter(values) }),
		}),
	],
});
const pendingOnly = $derived(showsPendingRequestsOnly(params.current.status));
const requestsQuery = createInfiniteQuery(() => ({
	...quotaIncreaseRequestsInfiniteQueryOptions({
		limit: ADMIN_PAGE_SIZE,
		status: pendingOnly ? QuotaIncreaseRequestStatus.Pending : undefined,
	}),
	...adminCursorPages,
	placeholderData: keepPreviousData,
}));
const decide = createMutation(() =>
	decideQuotaIncreaseRequestMutationOptions()
);
let reviewing = $state.raw<AdminQuotaIncreaseRequest | null>(null);

const loaded = $derived(adminPageItems(requestsQuery.data));
const requests = $derived(
	loaded.filter((request) =>
		matchesSearch(controls.search.value, [
			request.id,
			request.organizationId,
			request.organizationName ?? '',
			request.useCase,
		])
	)
);
const requestsById = $derived(
	new Map(loaded.map((request) => [request.id, request]))
);
const panel = new OpenRowParam(
	() => requests,
	(request) => request.id
);

const column = resourceColumnHelper<AdminQuotaIncreaseRequest>();
const columns = [
	column.accessor((request) => request.organizationName ?? '', {
		id: 'organization',
		header: 'Organization',
		meta: NAME_COLUMN,
		cell: ({ row }) =>
			renderResourceLabel({
				label: row.original.organizationName ?? row.original.organizationId,
				sublabel: `Tier ${row.original.organizationTier}`,
			}),
	}),
	column.accessor(requestedLimitsSummary, {
		id: 'requested',
		header: 'Requested',
		meta: GROW_COLUMN,
		cell: ({ row }) =>
			renderResourceLabel({
				label: requestedLimitsSummary(row.original),
				sublabel: requestClassLabel(row.original),
			}),
	}),
	column.accessor('status', {
		id: 'status',
		header: 'Status',
		meta: STATUS_COLUMN,
		cell: ({ row }) => renderSnippet(statusCell, row.original),
	}),
	column.accessor('createdAt', {
		id: 'sent',
		header: 'Sent',
		meta: TIME_COLUMN,
		cell: ({ getValue }) => timestampCell(getValue()),
	}),
	column.accessor((request) => request.reviewedAt ?? '', {
		id: 'reviewed',
		header: 'Reviewed',
		meta: { ...TIME_COLUMN, visibleFrom: 'xl' },
		cell: ({ row }) => timestampCell(row.original.reviewedAt),
	}),
	column.display({
		id: 'actions',
		header: 'Actions',
		meta: { variant: 'actions' },
		cell: ({ row }) => renderSnippet(actionsCell, row.original),
	}),
];

function startReview(request: AdminQuotaIncreaseRequest): void {
	reviewing = request;
}

function requestActions(
	request: AdminQuotaIncreaseRequest
): ResourceRowAction[] {
	return [
		{
			icon: Gauge,
			label: 'Review',
			onSelect: () => startReview(request),
			visible: isPendingRequest(request),
		},
		{
			icon: Copy,
			label: 'Copy organization ID',
			onSelect: () => copyId(request.organizationId),
		},
		{
			icon: Copy,
			label: 'Copy request ID',
			onSelect: () => copyId(request.id),
		},
	];
}

function requestRowActions(requestId: string): ResourceRowAction[] {
	const request = requestsById.get(requestId);
	return request ? requestActions(request) : [];
}
</script>

{#snippet statusCell(request: AdminQuotaIncreaseRequest)}
	<ResourceStateBadge state={request.status} />
{/snippet}

{#snippet actionsCell(request: AdminQuotaIncreaseRequest)}
	<ResourceRowActions
		label={`Quota request of ${request.organizationName ?? request.organizationId} actions`}
		actions={requestActions(request)}
	/>
{/snippet}

{#snippet emptyState()}
	<AdminTableEmpty
		message={QUOTA_REQUEST_EMPTY_MESSAGES[params.current.status]}
		resource="quota requests"
		search={controls.search.value}
		onClear={controls.clearSearchAndFilters}
	/>
{/snippet}

{#snippet panelActions()}
	{#if panel.row && isPendingRequest(panel.row)}
		{const request = $derived(panel.row)}
		<IconButton
			variant="ghost"
			label="Review request"
			icon={Gauge}
			onclick={() => startReview(request)}
		/>
	{/if}
{/snippet}

{#snippet detailsPanel()}
	<ResourceDetailsPanel
		open={panel.row !== null}
		title={panel.row?.organizationName ?? 'Quota request'}
		resourceId={panel.row?.id}
		resourceIdLabel="Copy request ID"
		onClose={panel.close}
		onPrevious={panel.previous}
		onNext={panel.next}
		actions={panelActions}
	>
		{#if panel.row}
			{const request = $derived(panel.row)}
			<PanelSection title="Request">
				<KeyValueList framed={false}>
					<KeyValueRow label="Status">
						<ResourceStateBadge state={request.status} />
					</KeyValueRow>
					<KeyValueRow
						label="Requested"
						value={requestedLimitsSummary(request)}
					/>
					<KeyValueRow
						label="Sandbox class"
						value={requestClassLabel(request)}
					/>
					<KeyValueRow
						label="Tier"
						value={`Tier ${request.organizationTier}`}
					/>
					<KeyValueRow label="Sent" value={formatDateTime(request.createdAt)} />
				</KeyValueList>
			</PanelSection>
			<PanelSection title="Use case">
				<p
					class="wrap-break-word whitespace-pre-wrap text-(--text-body) text-sm"
				>
					{request.useCase}
				</p>
			</PanelSection>
			<PanelSection title="People">
				<KeyValueList framed={false}>
					<KeyValueRow
						label="Organization"
						value={request.organizationId}
						mono
						copy={request.organizationId}
						copyLabel="Copy organization ID"
					/>
					<KeyValueRow
						label="Requested by"
						value={request.requestedBy}
						mono
						copy={request.requestedBy}
					/>
					{#if request.reviewedAt}
						<KeyValueRow
							label="Reviewed"
							value={formatDateTime(request.reviewedAt)}
						/>
						<KeyValueRow
							label="Reviewed by"
							value={request.reviewedBy}
							mono
							copy={request.reviewedBy}
						/>
						<KeyValueRow label="Decision" value={request.decisionReason} />
					{/if}
				</KeyValueList>
			</PanelSection>
		{/if}
	</ResourceDetailsPanel>
{/snippet}

<AdminToolbar
	{title}
	{viewSwitch}
	{controls}
	searchPlaceholder="Search quota requests"
/>
<ResourceRowContextMenu
	actionsFor={(rowId) => (rowId === null ? [] : requestRowActions(rowId))}
>
	<ResourceDataTable
		caption="Quota requests"
		{columns}
		data={requests}
		getRowId={(request) => request.id}
		rowLabel={(request) =>
			`Quota request of ${request.organizationName ?? request.organizationId}`}
		sort={controls.sort}
		sortConfig={controls.sortConfig}
		selectedRowId={panel.openId}
		isLoading={requestsQuery.isLoading}
		isFetching={requestsQuery.isRefetching}
		errorMessage={adminTableError(requestsQuery.error, 'quota requests')}
		empty={emptyState}
		onRetry={() => void requestsQuery.refetch()}
		onRowClick={panel.open}
		rowContextMenu
		hasMore={requestsQuery.hasNextPage}
		loadingMore={requestsQuery.isFetchingNextPage}
		onLoadMore={() => void requestsQuery.fetchNextPage()}
		overlay={detailsPanel}
	/>
</ResourceRowContextMenu>
<TableFooter
	label={countLabel(
		requests.length,
		'request',
		undefined,
		requestsQuery.hasNextPage
	)}
/>
<QuotaRequestDecisionModal
	request={reviewing}
	pending={decide.isPending}
	onClose={() => {
		reviewing = null;
	}}
	onDecide={(decision) =>
		decide.mutate(decision, {
			onSuccess: () => {
				reviewing = null;
			},
		})}
/>
