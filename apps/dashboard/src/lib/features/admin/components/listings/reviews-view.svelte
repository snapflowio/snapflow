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
import ShieldCheck from '@lucide/svelte/icons/shield-check';
import {
	type VerificationReview,
	VerificationReviewState,
} from '@snapflow/api-client';
import {
	createInfiniteQuery,
	createMutation,
	keepPreviousData,
} from '@tanstack/svelte-query';
import { renderSnippet } from '@tanstack/svelte-table';
import {
	resolveReviewMutationOptions,
	verificationReviewsInfiniteQueryOptions,
} from '#lib/api/admin/listings.ts';
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
	ADMIN_SEARCH_DEBOUNCE_MILLISECONDS,
	adminCursorPages,
	adminPageItems,
	copyId,
} from '#lib/features/admin/lib/admin-list.ts';
import { adminTableError } from '#lib/features/admin/lib/admin-load-error.ts';
import {
	isOpenReview,
	REVIEW_CLEARED_FILTERS,
	REVIEW_EMPTY_MESSAGES,
	REVIEW_FILTER_KEYS,
	REVIEW_KIND_OPTIONS,
	REVIEW_SORT_OPTIONS,
	REVIEW_STATE_OPTIONS,
	reviewStateFilterValues,
	reviewStateFromFilter,
	reviewsSearchSchema,
	showsOpenReviewsOnly,
} from '#lib/features/admin/lib/reviews-list.ts';
import { VERIFICATION_REVIEW_KIND_LABELS } from '#lib/features/admin/lib/verification-review.ts';
import { AdminListControls } from '#lib/features/admin/state/admin-list-controls.svelte.ts';
import type { AdminViewSwitch } from '#lib/features/admin/state/admin-view-param.svelte.ts';
import { OpenRowParam } from '#lib/routing/open-row-param.svelte.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
import { countLabel, formatDateTime } from '#lib/utils/format.ts';
import ReviewResolutionModal from './review-resolution-modal.svelte';

interface ReviewsViewProps {
	title: string;
	viewSwitch: AdminViewSwitch;
}

let { title, viewSwitch }: ReviewsViewProps = $props();

const params = new SearchParams(reviewsSearchSchema);
const controls = new AdminListControls(params, {
	sortOptions: REVIEW_SORT_OPTIONS,
	filterKeys: REVIEW_FILTER_KEYS,
	clearedFilterValues: REVIEW_CLEARED_FILTERS,
	searchWait: ADMIN_SEARCH_DEBOUNCE_MILLISECONDS,
	filterFields: () => [
		adminFilter({
			id: 'kind',
			label: 'Finding',
			options: REVIEW_KIND_OPTIONS,
			values: params.current.kind,
			onChange: (kind) => void params.update({ kind }),
		}),
		adminFilter({
			id: 'state',
			label: 'Status',
			options: REVIEW_STATE_OPTIONS,
			values: reviewStateFilterValues(params.current.state),
			onChange: (values) =>
				void params.update({ state: reviewStateFromFilter(values) }),
		}),
	],
});
const openOnly = $derived(showsOpenReviewsOnly(params.current.state));
const reviewsQuery = createInfiniteQuery(() => ({
	...verificationReviewsInfiniteQueryOptions({
		limit: ADMIN_PAGE_SIZE,
		state: openOnly ? VerificationReviewState.Open : undefined,
		query: params.current.q.trim() || undefined,
		kinds: params.current.kind,
	}),
	...adminCursorPages,
	placeholderData: keepPreviousData,
}));
const resolveReview = createMutation(() => resolveReviewMutationOptions());
let resolving = $state.raw<VerificationReview | null>(null);

const reviews = $derived(adminPageItems(reviewsQuery.data));
const reviewsById = $derived(
	new Map(reviews.map((review) => [review.id, review]))
);
const panel = new OpenRowParam(
	() => reviews,
	(review) => review.id
);

const column = resourceColumnHelper<VerificationReview>();
const columns = [
	column.accessor('machineId', {
		id: 'machine',
		header: 'Machine',
		meta: NAME_COLUMN,
		cell: ({ row }) =>
			renderResourceLabel({
				label: row.original.machineId,
				sublabel: row.original.referenceId,
			}),
	}),
	column.accessor((review) => VERIFICATION_REVIEW_KIND_LABELS[review.kind], {
		id: 'kind',
		header: 'Finding',
		meta: GROW_COLUMN,
		cell: ({ getValue }) => renderResourceLabel({ label: getValue() }),
	}),
	column.accessor('state', {
		id: 'state',
		header: 'State',
		meta: STATUS_COLUMN,
		cell: ({ row }) => renderSnippet(stateCell, row.original),
	}),
	column.accessor('openedAt', {
		id: 'opened',
		header: 'Opened',
		meta: TIME_COLUMN,
		cell: ({ getValue }) => timestampCell(getValue()),
	}),
	column.accessor((review) => review.resolvedAt ?? '', {
		id: 'resolved',
		header: 'Resolved',
		meta: { ...TIME_COLUMN, visibleFrom: 'xl' },
		cell: ({ row }) => timestampCell(row.original.resolvedAt),
	}),
	column.display({
		id: 'actions',
		header: 'Actions',
		meta: { variant: 'actions' },
		cell: ({ row }) => renderSnippet(actionsCell, row.original),
	}),
];

function startResolve(review: VerificationReview): void {
	resolving = review;
}

function reviewActions(review: VerificationReview): ResourceRowAction[] {
	return [
		{
			icon: ShieldCheck,
			label: 'Resolve',
			onSelect: () => startResolve(review),
			visible: isOpenReview(review),
		},
		{
			icon: Copy,
			label: 'Copy machine ID',
			onSelect: () => copyId(review.machineId),
		},
		{ icon: Copy, label: 'Copy review ID', onSelect: () => copyId(review.id) },
	];
}

function reviewRowActions(reviewId: string): ResourceRowAction[] {
	const review = reviewsById.get(reviewId);
	return review ? reviewActions(review) : [];
}
</script>

{#snippet stateCell(review: VerificationReview)}
	<ResourceStateBadge state={review.state} />
{/snippet}

{#snippet actionsCell(review: VerificationReview)}
	<ResourceRowActions
		label={`Review of ${review.machineId} actions`}
		actions={reviewActions(review)}
	/>
{/snippet}

{#snippet emptyState()}
	<AdminTableEmpty
		message={REVIEW_EMPTY_MESSAGES[params.current.state]}
		resource="reviews"
		search={controls.query}
		filterCount={params.current.kind.length}
		onClear={controls.clearSearchAndFilters}
	/>
{/snippet}

{#snippet panelActions()}
	{#if panel.row && isOpenReview(panel.row)}
		{const review = $derived(panel.row)}
		<IconButton
			variant="ghost"
			label="Resolve review"
			icon={ShieldCheck}
			onclick={() => startResolve(review)}
		/>
	{/if}
{/snippet}

{#snippet detailsPanel()}
	<ResourceDetailsPanel
		open={panel.row !== null}
		title={panel.row
			? VERIFICATION_REVIEW_KIND_LABELS[panel.row.kind]
			: 'Review'}
		resourceId={panel.row?.id}
		resourceIdLabel="Copy review ID"
		onClose={panel.close}
		onPrevious={panel.previous}
		onNext={panel.next}
		actions={panelActions}
	>
		{#if panel.row}
			{const review = $derived(panel.row)}
			<PanelSection title="Review">
				<KeyValueList framed={false}>
					<KeyValueRow label="State">
						<ResourceStateBadge state={review.state} />
					</KeyValueRow>
					<KeyValueRow
						label="Machine"
						value={review.machineId}
						mono
						copy={review.machineId}
						copyLabel="Copy machine ID"
					/>
					<KeyValueRow
						label="Reference"
						value={review.referenceId}
						mono
						copy={review.referenceId}
					/>
					<KeyValueRow label="Opened" value={formatDateTime(review.openedAt)} />
					{#if review.resolvedAt}
						<KeyValueRow
							label="Resolved"
							value={formatDateTime(review.resolvedAt)}
						/>
						<KeyValueRow label="Resolved by" value={review.resolvedBy} />
						<KeyValueRow label="Resolution" value={review.resolutionReason} />
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
	searchPlaceholder="Search reviews"
/>
<ResourceRowContextMenu
	actionsFor={(rowId) => (rowId === null ? [] : reviewRowActions(rowId))}
>
	<ResourceDataTable
		caption="Verification reviews"
		{columns}
		data={reviews}
		getRowId={(review) => review.id}
		rowLabel={(review) => `Review of ${review.machineId}`}
		sort={controls.sort}
		sortConfig={controls.sortConfig}
		selectedRowId={panel.openId}
		isLoading={reviewsQuery.isLoading}
		isFetching={reviewsQuery.isRefetching}
		errorMessage={adminTableError(reviewsQuery.error, 'reviews')}
		empty={emptyState}
		onRetry={() => void reviewsQuery.refetch()}
		onRowClick={panel.open}
		rowContextMenu
		hasMore={reviewsQuery.hasNextPage}
		loadingMore={reviewsQuery.isFetchingNextPage}
		onLoadMore={() => void reviewsQuery.fetchNextPage()}
		overlay={detailsPanel}
	/>
</ResourceRowContextMenu>
<TableFooter
	label={countLabel(
		reviews.length,
		'review',
		undefined,
		reviewsQuery.hasNextPage
	)}
/>
<ReviewResolutionModal
	review={resolving}
	pending={resolveReview.isPending}
	onClose={() => {
		resolving = null;
	}}
	onResolve={(review, resolution) =>
		resolveReview.mutate(
			{ resolution, reviewId: review.id },
			{
				onSuccess: () => {
					resolving = null;
				},
			}
		)}
/>
