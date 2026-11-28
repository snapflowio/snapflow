<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const YES = 'Yes';
const NO = 'No';
const FLAG_SEPARATOR = ' · ';
</script>

<script lang="ts">
import Copy from '@lucide/svelte/icons/copy';
import Pencil from '@lucide/svelte/icons/pencil';
import type { AdminListing } from '@snapflow/api-client';
import {
	createInfiniteQuery,
	createMutation,
	keepPreviousData,
} from '@tanstack/svelte-query';
import { renderSnippet } from '@tanstack/svelte-table';
import {
	adminListingsInfiniteQueryOptions,
	updateMachineTierMutationOptions,
} from '#lib/api/admin/listings.ts';
import PanelSection from '#lib/components/detail/panel-section.svelte';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import ResourceDetailsPanel from '#lib/components/resource/resource-details-panel.svelte';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
import ResourceRowContextMenu from '#lib/components/resource/resource-row-context-menu.svelte';
import { renderResourceLabel } from '#lib/components/resource/table/resource-cell.ts';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import { EMPTY_CELL_PLACEHOLDER } from '#lib/components/resource/table/resource-table.ts';
import { resourceColumnHelper } from '#lib/components/resource/table/resource-table-model.ts';
import { timestampCell } from '#lib/components/resource/table/rich-cells.ts';
import TableFooter from '#lib/components/resource/table/table-footer.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import IconButton from '#lib/components/ui/icon-button.svelte';
import { middleTruncate } from '#lib/components/ui/overflow/middle-truncate.ts';
import AdminTableEmpty from '#lib/features/admin/components/shared/admin-table-empty.svelte';
import AdminToolbar from '#lib/features/admin/components/shared/admin-toolbar.svelte';
import {
	COUNT_COLUMN,
	GROW_COLUMN,
	NAME_COLUMN,
	TAG_COLUMN,
	TIME_COLUMN,
} from '#lib/features/admin/lib/admin-columns.ts';
import {
	adminFilter,
	adminFilterOptions,
} from '#lib/features/admin/lib/admin-filters.ts';
import {
	ADMIN_PAGE_SIZE,
	ADMIN_SEARCH_DEBOUNCE_MILLISECONDS,
	adminCursorPages,
	adminPageItems,
	copyId,
} from '#lib/features/admin/lib/admin-list.ts';
import { adminTableError } from '#lib/features/admin/lib/admin-load-error.ts';
import {
	LISTING_FILTER_KEYS,
	LISTING_FLAG_LABELS,
	LISTING_SORT_OPTIONS,
	LISTING_TIER_OPTIONS,
	listingApprovalLabel,
	listingCategoryLabel,
	listingFlags,
	listingRestrictionLabel,
	listingsSearchSchema,
	listingTierCapLabel,
	listingUtilizationLabel,
	NOT_APPROVED_LABEL,
	tierReasonLabel,
} from '#lib/features/admin/lib/listings-list.ts';
import { AdminListControls } from '#lib/features/admin/state/admin-list-controls.svelte.ts';
import type { AdminViewSwitch } from '#lib/features/admin/state/admin-view-param.svelte.ts';
import {
	MACHINE_TIER_LABELS,
	MACHINE_TIER_ORDER,
	tierBadgeVariant,
} from '#lib/features/listings/lib/listing-format.ts';
import { OpenRowParam } from '#lib/routing/open-row-param.svelte.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
import { countLabel, formatDateTime } from '#lib/utils/format.ts';
import MachineTierModal from './machine-tier-modal.svelte';

interface ListingsViewProps {
	title: string;
	viewSwitch: AdminViewSwitch;
}

let { title, viewSwitch }: ListingsViewProps = $props();

const params = new SearchParams(listingsSearchSchema);
const controls = new AdminListControls(params, {
	sortOptions: LISTING_SORT_OPTIONS,
	filterKeys: LISTING_FILTER_KEYS,
	searchWait: ADMIN_SEARCH_DEBOUNCE_MILLISECONDS,
	filterFields: () => [
		adminFilter({
			id: 'tier',
			label: 'Tier',
			options: LISTING_TIER_OPTIONS,
			values: params.current.tier,
			onChange: (tier) => void params.update({ tier }),
		}),
		adminFilter({
			id: 'flags',
			label: 'Flags',
			options: adminFilterOptions(LISTING_FLAG_LABELS),
			values: params.current.flags,
			onChange: (flags) => void params.update({ flags }),
		}),
	],
});
const listingsQuery = createInfiniteQuery(() => ({
	...adminListingsInfiniteQueryOptions({
		limit: ADMIN_PAGE_SIZE,
		query: params.current.q.trim() || undefined,
		tiers: params.current.tier,
		flags: params.current.flags,
	}),
	...adminCursorPages,
	placeholderData: keepPreviousData,
}));
const updateTier = createMutation(() => updateMachineTierMutationOptions());
let editing = $state.raw<AdminListing | null>(null);

const listings = $derived(adminPageItems(listingsQuery.data));
const listingsById = $derived(
	new Map(listings.map((listing) => [listing.machineId, listing]))
);
const panel = new OpenRowParam(
	() => listings,
	(listing) => listing.machineId
);

const column = resourceColumnHelper<AdminListing>();
const columns = [
	column.accessor('machineId', {
		id: 'machine',
		header: 'Machine',
		meta: NAME_COLUMN,
		cell: ({ row }) => renderSnippet(machineCell, row.original),
	}),
	column.accessor((listing) => MACHINE_TIER_ORDER.indexOf(listing.tier), {
		id: 'tier',
		header: 'Tier',
		meta: TAG_COLUMN,
		cell: ({ row }) => renderSnippet(tierBadge, row.original),
	}),
	column.accessor('adminTierCap', {
		id: 'cap',
		header: 'Tier cap',
		meta: { ...TAG_COLUMN, visibleFrom: 'xl' },
		cell: ({ row }) =>
			renderResourceLabel({
				label: listingTierCapLabel(row.original),
				sublabel: row.original.adminTierCapReason ?? undefined,
			}),
	}),
	column.accessor('datacenterApprovedAt', {
		id: 'datacenter',
		header: 'Datacenter',
		meta: { ...TIME_COLUMN, visibleFrom: 'lg' },
		cell: ({ getValue }) => timestampCell(getValue(), NOT_APPROVED_LABEL),
	}),
	column.accessor((listing) => listingFlags(listing).join(FLAG_SEPARATOR), {
		id: 'flags',
		header: 'Flags',
		meta: GROW_COLUMN,
		cell: ({ getValue }) => renderResourceLabel({ label: getValue() || null }),
	}),
	column.display({
		id: 'utilization',
		header: 'Rented 7d',
		meta: COUNT_COLUMN,
		cell: ({ row }) =>
			renderResourceLabel({
				label: listingUtilizationLabel(
					row.original.utilization.lastWeekBasisPoints
				),
			}),
	}),
	column.accessor((listing) => listing.measuredAt ?? '', {
		id: 'measured',
		header: 'Measured',
		meta: { ...TIME_COLUMN, visibleFrom: 'xl' },
		cell: ({ row }) => timestampCell(row.original.measuredAt),
	}),
	column.display({
		id: 'actions',
		header: 'Actions',
		meta: { variant: 'actions' },
		cell: ({ row }) => renderSnippet(actionsCell, row.original),
	}),
];

function startEdit(listing: AdminListing): void {
	editing = listing;
}

function listingActions(listing: AdminListing): ResourceRowAction[] {
	return [
		{
			icon: Pencil,
			label: 'Edit tier',
			onSelect: () => startEdit(listing),
		},
		{
			icon: Copy,
			label: 'Copy machine ID',
			onSelect: () => copyId(listing.machineId),
		},
		{
			icon: Copy,
			label: 'Copy organization ID',
			onSelect: () => copyId(listing.organizationId),
		},
	];
}

function listingRowActions(machineId: string): ResourceRowAction[] {
	const listing = listingsById.get(machineId);
	return listing ? listingActions(listing) : [];
}
</script>

{#snippet tierBadge(listing: AdminListing)}
	<Badge size="sm" variant={tierBadgeVariant(listing.tier)}>
		{MACHINE_TIER_LABELS[listing.tier]}
	</Badge>
{/snippet}

{#snippet machineCell(listing: AdminListing)}
	<span class="flex min-w-0 items-baseline gap-1.5">
		<span
			class="block min-w-0 overflow-hidden whitespace-nowrap font-mono text-(--text-primary) text-xs"
			{@attach middleTruncate({ text: listing.machineId })}
		></span>
		<span class="shrink-0 text-(--text-muted) text-xs">
			{listingCategoryLabel(listing)}
		</span>
	</span>
{/snippet}

{#snippet tierReasons(listing: AdminListing)}
	{#if listing.tierReasons.length > 0}
		<span class="flex flex-wrap gap-1">
			{#each listing.tierReasons as reason (reason)}
				<Badge size="pill">{tierReasonLabel(reason)}</Badge>
			{/each}
		</span>
	{:else}
		<span class="text-(--text-muted)">{EMPTY_CELL_PLACEHOLDER}</span>
	{/if}
{/snippet}

{#snippet actionsCell(listing: AdminListing)}
	<ResourceRowActions
		label={`${listing.machineId} actions`}
		actions={listingActions(listing)}
	/>
{/snippet}

{#snippet emptyState()}
	<AdminTableEmpty
		message="No listings yet"
		resource="listings"
		search={controls.query}
		filterCount={controls.filterCount}
		onClear={controls.clearSearchAndFilters}
	/>
{/snippet}

{#snippet panelActions()}
	{#if panel.row}
		{const listing = $derived(panel.row)}
		<IconButton
			variant="ghost"
			label="Edit tier"
			icon={Pencil}
			onclick={() => startEdit(listing)}
		/>
	{/if}
{/snippet}

{#snippet detailsPanel()}
	<ResourceDetailsPanel
		open={panel.row !== null}
		title="Listing"
		resourceId={panel.row?.machineId}
		resourceIdLabel="Copy machine ID"
		onClose={panel.close}
		onPrevious={panel.previous}
		onNext={panel.next}
		actions={panelActions}
	>
		{#if panel.row}
			{const listing = $derived(panel.row)}
			<div class="flex flex-col">
				<PanelSection title="Tier">
					<KeyValueList framed={false}>
						<KeyValueRow label="Tier">
							{@render tierBadge(listing)}
						</KeyValueRow>
						<KeyValueRow label="Tier reasons">
							{@render tierReasons(listing)}
						</KeyValueRow>
						<KeyValueRow
							label="Tier cap"
							value={listingTierCapLabel(listing)}
							info={listing.adminTierCapReason ?? undefined}
						/>
						<KeyValueRow
							label="Category"
							value={listingCategoryLabel(listing)}
						/>
						<KeyValueRow
							label="Measured"
							value={listing.measuredAt
								? formatDateTime(listing.measuredAt)
								: null}
						/>
					</KeyValueList>
				</PanelSection>
				<PanelSection title="Review">
					<KeyValueList framed={false}>
						<KeyValueRow
							label="Datacenter approval"
							value={listingApprovalLabel(listing)}
						/>
						<KeyValueRow
							label="Fingerprint conflict"
							value={listing.fingerprintConflict ? YES : NO}
						/>
						<KeyValueRow
							label="Restricted"
							value={listingRestrictionLabel(listing)}
							info={listing.restrictionReason ?? undefined}
						/>
					</KeyValueList>
				</PanelSection>
				<PanelSection title="Rentals">
					<KeyValueList framed={false}>
						<KeyValueRow
							label="Last 7 days"
							value={listingUtilizationLabel(
								listing.utilization.lastWeekBasisPoints
							)}
						/>
						<KeyValueRow
							label="Last 30 days"
							value={listingUtilizationLabel(
								listing.utilization.lastMonthBasisPoints
							)}
						/>
					</KeyValueList>
				</PanelSection>
				<PanelSection title="Owner">
					<KeyValueList framed={false}>
						<KeyValueRow
							label="Organization"
							value={listing.organizationId}
							mono
							copy={listing.organizationId}
							copyLabel="Copy organization ID"
						/>
					</KeyValueList>
				</PanelSection>
			</div>
		{/if}
	</ResourceDetailsPanel>
{/snippet}

<AdminToolbar
	{title}
	{viewSwitch}
	{controls}
	searchPlaceholder="Search listings"
/>
<ResourceRowContextMenu
	actionsFor={(rowId) => (rowId === null ? [] : listingRowActions(rowId))}
>
	<ResourceDataTable
		caption="Listings"
		{columns}
		data={listings}
		getRowId={(listing) => listing.machineId}
		rowLabel={(listing) => listing.machineId}
		sort={controls.sort}
		sortConfig={controls.sortConfig}
		selectedRowId={panel.openId}
		isLoading={listingsQuery.isLoading}
		isFetching={listingsQuery.isRefetching}
		errorMessage={adminTableError(listingsQuery.error, 'listings')}
		empty={emptyState}
		onRetry={() => void listingsQuery.refetch()}
		onRowClick={panel.open}
		rowContextMenu
		hasMore={listingsQuery.hasNextPage}
		loadingMore={listingsQuery.isFetchingNextPage}
		onLoadMore={() => void listingsQuery.fetchNextPage()}
		overlay={detailsPanel}
	/>
</ResourceRowContextMenu>
<TableFooter
	label={countLabel(
		listings.length,
		'listing',
		undefined,
		listingsQuery.hasNextPage
	)}
/>
<MachineTierModal
	listing={editing}
	pending={updateTier.isPending}
	onClose={() => {
		editing = null;
	}}
	onSave={(listing, change) =>
		updateTier.mutate(
			{ change, machineId: listing.machineId },
			{
				onSuccess: () => {
					editing = null;
				},
			}
		)}
/>
