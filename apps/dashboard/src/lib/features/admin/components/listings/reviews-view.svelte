<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import {
	type VerificationReview,
	VerificationReviewKind,
	VerificationReviewState,
} from '@snapflow/api-client';
import * as z from 'zod';
import {
	adminSearchField,
	adminSortFields,
} from '#lib/features/admin/lib/admin-list.ts';
import { VERIFICATION_REVIEW_KIND_LABELS } from '#lib/features/admin/lib/verification-review.ts';
import { searchParamArray } from '#lib/routing/search-params.ts';

const ALL_REVIEWS = 'all';
const REVIEW_STATE_OPTIONS = [
	{ label: 'Open', value: VerificationReviewState.Open },
	{ label: 'All', value: ALL_REVIEWS },
];
const SORT_OPTIONS = [
	{ id: 'opened', label: 'Opened' },
	{ id: 'resolved', label: 'Resolved' },
] as const;
const KIND_OPTIONS = Object.values(VerificationReviewKind).map((kind) => ({
	label: VERIFICATION_REVIEW_KIND_LABELS[kind],
	value: kind,
}));

const reviewsSearchSchema = z.object({
	q: adminSearchField,
	...adminSortFields(['opened', 'resolved']),
	state: z
		.enum([VerificationReviewState.Open, ALL_REVIEWS])
		.catch(VerificationReviewState.Open),
	kind: searchParamArray(z.enum(VerificationReviewKind)).catch([]),
});

function isOpen(review: VerificationReview): boolean {
	return review.state === VerificationReviewState.Open;
}
</script>

<script lang="ts">
import Copy from '@lucide/svelte/icons/copy';
import ShieldCheck from '@lucide/svelte/icons/shield-check';
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
import EmptyState from '#lib/components/empty-state.svelte';
import ResourceDetailsPanel from '#lib/components/resource/resource-details-panel.svelte';
import ResourceOptionsBar from '#lib/components/resource/resource-options-bar.svelte';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import { renderResourceLabel } from '#lib/components/resource/table/resource-cell.ts';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import { resourceColumnHelper } from '#lib/components/resource/table/resource-table-model.ts';
import { timeCell } from '#lib/components/resource/table/time-cell.ts';
import ChipSwitch from '#lib/components/ui/chip/chip-switch.svelte';
import IconButton from '#lib/components/ui/icon-button.svelte';
import AdminFilterPanel from '#lib/features/admin/components/admin-filter-panel.svelte';
import AdminNoResults from '#lib/features/admin/components/admin-no-results.svelte';
import AdminRecordDetails from '#lib/features/admin/components/admin-record-details.svelte';
import AdminTableContextMenu from '#lib/features/admin/components/admin-table-context-menu.svelte';
import { adminTableErrorProps } from '#lib/features/admin/components/admin-table-error.svelte';
import {
	type AdminFilterField,
	adminFilter,
	adminFilterTags,
} from '#lib/features/admin/lib/admin-filters.ts';
import {
	ADMIN_PAGE_SIZE,
	adminCursorPages,
	adminPageItems,
	adminSortConfig,
	adminSortState,
	copyId,
	matchesFilter,
	matchesSearch,
} from '#lib/features/admin/lib/admin-list.ts';
import { OpenRowParam } from '#lib/routing/open-row-param.svelte.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
import { formatDateTime } from '#lib/utils/format.ts';
import ReviewResolutionModal from './review-resolution-modal.svelte';

const params = new SearchParams(reviewsSearchSchema);
const search = params.text('q');
const reviewsQuery = createInfiniteQuery(() => ({
	...verificationReviewsInfiniteQueryOptions({
		limit: ADMIN_PAGE_SIZE,
		state:
			params.current.state === VerificationReviewState.Open
				? VerificationReviewState.Open
				: undefined,
	}),
	...adminCursorPages,
	placeholderData: keepPreviousData,
}));
const resolveReview = createMutation(() => resolveReviewMutationOptions());
let resolving = $state.raw<VerificationReview | null>(null);

const loaded = $derived(adminPageItems(reviewsQuery.data));
const reviews = $derived(
	loaded.filter(
		(review) =>
			matchesSearch(search.value, [
				review.id,
				review.machineId,
				review.referenceId,
			]) && matchesFilter(params.current.kind, review.kind)
	)
);
const reviewsById = $derived(
	new Map(loaded.map((review) => [review.id, review]))
);
const panel = new OpenRowParam(
	() => reviews,
	(review) => review.id
);
const sort = $derived(adminSortState(params.current.sort, params.current.dir));
const filterFields: AdminFilterField[] = $derived([
	adminFilter({
		id: 'kind',
		label: 'Finding',
		options: KIND_OPTIONS,
		values: params.current.kind,
		onChange: (kind) => void params.update({ kind }),
	}),
]);
const filterTags = $derived(adminFilterTags(filterFields));

const column = resourceColumnHelper<VerificationReview>();
const columns = [
	column.accessor('machineId', {
		id: 'machine',
		header: 'Machine',
		cell: ({ row }) =>
			renderResourceLabel({
				icon: shieldIcon,
				label: row.original.machineId,
				sublabel: row.original.referenceId,
			}),
	}),
	column.accessor((review) => VERIFICATION_REVIEW_KIND_LABELS[review.kind], {
		id: 'kind',
		header: 'Finding',
		cell: ({ getValue }) => renderResourceLabel({ label: getValue() }),
	}),
	column.accessor('state', {
		id: 'state',
		header: 'State',
		cell: ({ row }) => renderSnippet(stateCell, row.original),
	}),
	column.accessor('openedAt', {
		id: 'opened',
		header: 'Opened',
		cell: ({ getValue }) => renderResourceLabel(timeCell(getValue())),
	}),
	column.accessor((review) => review.resolvedAt ?? '', {
		id: 'resolved',
		header: 'Resolution',
		cell: ({ row }) =>
			renderResourceLabel({
				label: row.original.resolutionReason,
				sublabel: row.original.resolvedAt
					? formatDateTime(row.original.resolvedAt)
					: undefined,
			}),
	}),
	column.display({
		id: 'actions',
		header: 'Actions',
		meta: { variant: 'actions' },
		cell: ({ row }) => renderSnippet(actionsCell, row.original),
	}),
];

function reviewActions(review: VerificationReview): ResourceRowAction[] {
	return [
		{
			icon: ShieldCheck,
			label: 'Resolve',
			onSelect: () => {
				resolving = review;
			},
			visible: isOpen(review),
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

function clearSearchAndFilters() {
	search.value = '';
	void params.update({ q: undefined, kind: undefined });
}
</script>

{#snippet shieldIcon()}
	<ShieldCheck />
{/snippet}

{#snippet stateCell(
	review: VerificationReview
)}
	<ResourceStateBadge state={review.state} />
{/snippet}

{#snippet actionsCell(
	review: VerificationReview
)}
	<ResourceRowActions
		label={`Review ${review.id} actions`}
		actions={reviewActions(review)}
	/>
{/snippet}

{#snippet stateSwitch()}
	<ChipSwitch
		aria-label="Review state"
		options={REVIEW_STATE_OPTIONS}
		bind:value={
			() => params.current.state,
			(state) =>
	void params.update({ state: reviewsSearchSchema.shape.state.parse(state) })
		}
	/>
{/snippet}

{#snippet filterContent()}
	<AdminFilterPanel
		fields={filterFields}
		onClear={() => void params.update({ kind: undefined })}
	/>
{/snippet}

{#snippet emptyState()}
	{#if search.value || filterTags.length > 0}
		<AdminNoResults
			search={search.value}
			filterCount={filterTags.length}
			onClear={clearSearchAndFilters}
		/>
	{:else if params.current.state === VerificationReviewState.Open}
		<EmptyState
			title="Review queue"
			description="Verification findings that need a decision appear here."
		/>
	{:else}
		<EmptyState
			title="Review queue"
			description="No machine has had a verification finding yet."
		/>
	{/if}
{/snippet}

{#snippet panelActions()}
	{#if panel.row && isOpen(panel.row)}
		{const review = $derived(panel.row)}
		<IconButton
			variant="ghost"
			label="Resolve"
			icon={ShieldCheck}
			onclick={() => {
				resolving = review;
			}}
		/>
	{/if}
{/snippet}

{#snippet detailsPanel()}
	<ResourceDetailsPanel
		open={panel.row !== null}
		title="Review details"
		onClose={panel.close}
		onPrevious={panel.previous}
		onNext={panel.next}
		actions={panelActions}
	>
		{#if panel.row}
			{const review = $derived(panel.row)}
			<AdminRecordDetails
				summary={[
					{ label: 'Opened', value: formatDateTime(review.openedAt) },
					{
						label: 'Finding',
						value: VERIFICATION_REVIEW_KIND_LABELS[review.kind],
					},
				]}
				fields={[
					{ label: 'Machine', value: review.machineId, mono: true },
					{ label: 'Reference', value: review.referenceId, mono: true },
					{ label: 'State', content: reviewState },
					{
						label: 'Resolved',
						value: review.resolvedAt ? formatDateTime(review.resolvedAt) : null,
					},
					{ label: 'Resolved by', value: review.resolvedBy },
				]}
				notes={[{ label: 'Resolution', value: review.resolutionReason }]}
			/>
			{#snippet reviewState()}
				<ResourceStateBadge state={review.state} />
			{/snippet}
		{/if}
	</ResourceDetailsPanel>
{/snippet}

<ResourceOptionsBar
	search={{
		value: search.value,
		onChange: (value) => {
			search.value = value;
		},
		placeholder: 'Search reviews...',
		ariaLabel: 'Search reviews',
	}}
	extras={stateSwitch}
	{filterTags}
	onClearFilters={() => void params.update({ kind: undefined })}
	filter={{ content: filterContent, active: filterTags.length > 0 }}
	sort={adminSortConfig(SORT_OPTIONS, sort, (sortColumn, dir) =>
		params.update({ sort: sortColumn, dir })
	)}
/>
<AdminTableContextMenu rowActions={reviewRowActions}>
	<ResourceDataTable
		caption="Verification reviews"
		{columns}
		data={reviews}
		getRowId={(review) => review.id}
		rowLabel={(review) => `Review of ${review.machineId}`}
		{sort}
		selectedRowId={panel.openId}
		isLoading={reviewsQuery.isLoading}
		empty={emptyState}
		onRetry={() => void reviewsQuery.refetch()}
		onRowClick={panel.open}
		onRowContextMenu={() => {}}
		hasMore={reviewsQuery.hasNextPage}
		loadingMore={reviewsQuery.isFetchingNextPage}
		onLoadMore={() => void reviewsQuery.fetchNextPage()}
		overlay={detailsPanel}
		{...adminTableErrorProps(reviewsQuery.error, 'Failed to load reviews')}
	/>
</AdminTableContextMenu>
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
