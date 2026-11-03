<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { type AdminListing, MachineTier } from '@snapflow/api-client';
import * as z from 'zod';
import {
	adminFilterField,
	adminSearchField,
	adminSortFields,
} from '#lib/features/admin/lib/admin-list.ts';
import {
	MACHINE_CATEGORY_LABELS,
	MACHINE_TIER_LABELS,
	MACHINE_TIER_ORDER,
} from '#lib/features/listings/lib/listing-format.ts';
import { searchParamArray } from '#lib/routing/search-params.ts';

const NOT_BENCHMARKED_LABEL = 'Not benchmarked';
const NO_CAP_LABEL = 'None';
const NOT_APPROVED_LABEL = 'Not approved';
const SORT_OPTIONS = [
	{ id: 'tier', label: 'Tier' },
	{ id: 'measured', label: 'Measured' },
] as const;
const TIER_OPTIONS = MACHINE_TIER_ORDER.map((tier) => ({
	label: MACHINE_TIER_LABELS[tier],
	value: tier,
}));
const FILTER_KEYS = ['tier', 'flags'] as const;
const FLAG_LABELS = {
	conflict: 'Fingerprint conflict',
	restricted: 'Restricted',
	clean: 'No flags',
} as const;

const listingsSearchSchema = z.object({
	q: adminSearchField,
	...adminSortFields(['tier', 'measured']),
	tier: searchParamArray(z.enum(MachineTier)).catch([]),
	flags: adminFilterField(['conflict', 'restricted', 'clean']),
});

function listingFlags(listing: AdminListing): string[] {
	return [
		listing.fingerprintConflict ? FLAG_LABELS.conflict : null,
		listing.restrictedAt
			? `Restricted${listing.restrictionReason ? `: ${listing.restrictionReason}` : ''}`
			: null,
	].filter((flag) => flag !== null);
}

function listingFlagIds(listing: AdminListing): string[] {
	const flags = [
		listing.fingerprintConflict ? 'conflict' : null,
		listing.restrictedAt ? 'restricted' : null,
	].filter((flag) => flag !== null);
	return flags.length > 0 ? flags : ['clean'];
}
</script>

<script lang="ts">
import Copy from '@lucide/svelte/icons/copy';
import Cpu from '@lucide/svelte/icons/cpu';
import Pencil from '@lucide/svelte/icons/pencil';
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
import ResourceDetailsPanel from '#lib/components/resource/resource-details-panel.svelte';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
import { renderResourceLabel } from '#lib/components/resource/table/resource-cell.ts';
import ResourceDataTable from '#lib/components/resource/table/resource-data-table.svelte';
import { resourceColumnHelper } from '#lib/components/resource/table/resource-table-model.ts';
import { timeCell } from '#lib/components/resource/table/time-cell.ts';
import Badge from '#lib/components/ui/badge.svelte';
import IconButton from '#lib/components/ui/icon-button.svelte';
import AdminListEmpty from '#lib/features/admin/components/admin-list-empty.svelte';
import AdminListOptionsBar from '#lib/features/admin/components/admin-list-options-bar.svelte';
import AdminRecordDetails from '#lib/features/admin/components/admin-record-details.svelte';
import AdminTableContextMenu from '#lib/features/admin/components/admin-table-context-menu.svelte';
import { adminTableErrorProps } from '#lib/features/admin/components/admin-table-error.svelte';
import {
	adminFilter,
	adminFilterOptions,
} from '#lib/features/admin/lib/admin-filters.ts';
import {
	ADMIN_PAGE_SIZE,
	adminCursorPages,
	adminPageItems,
	copyId,
	matchesFilter,
	matchesSearch,
} from '#lib/features/admin/lib/admin-list.ts';
import { AdminListControls } from '#lib/features/admin/state/admin-list-controls.svelte.ts';
import { tierBadgeVariant } from '#lib/features/listings/lib/listing-format.ts';
import { OpenRowParam } from '#lib/routing/open-row-param.svelte.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
import { formatDateTime } from '#lib/utils/format.ts';
import MachineTierModal from './machine-tier-modal.svelte';

const params = new SearchParams(listingsSearchSchema);
const controls = new AdminListControls(params, {
	sortOptions: SORT_OPTIONS,
	filterKeys: FILTER_KEYS,
	filterFields: () => [
		adminFilter({
			id: 'tier',
			label: 'Tier',
			options: TIER_OPTIONS,
			values: params.current.tier,
			onChange: (tier) => void params.update({ tier }),
		}),
		adminFilter({
			id: 'flags',
			label: 'Flags',
			options: adminFilterOptions(FLAG_LABELS),
			values: params.current.flags,
			onChange: (flags) => void params.update({ flags }),
		}),
	],
});
const serverTier = $derived(
	params.current.tier.length === 1 ? params.current.tier[0] : undefined
);
const listingsQuery = createInfiniteQuery(() => ({
	...adminListingsInfiniteQueryOptions({
		limit: ADMIN_PAGE_SIZE,
		tier: serverTier,
	}),
	...adminCursorPages,
	placeholderData: keepPreviousData,
}));
const updateTier = createMutation(() => updateMachineTierMutationOptions());
let editing = $state.raw<AdminListing | null>(null);

const loaded = $derived(adminPageItems(listingsQuery.data));
const listings = $derived(
	loaded.filter(
		(listing) =>
			matchesSearch(controls.search.value, [
				listing.machineId,
				listing.organizationId,
			]) &&
			matchesFilter(params.current.tier, listing.tier) &&
			(params.current.flags.length === 0 ||
				listingFlagIds(listing).some((flag) =>
					params.current.flags.some((selected) => selected === flag)
				))
	)
);
const listingsById = $derived(
	new Map(loaded.map((listing) => [listing.machineId, listing]))
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
		cell: ({ row }) =>
			renderResourceLabel({
				icon: cpuIcon,
				label: row.original.machineId,
				sublabel: row.original.category
					? MACHINE_CATEGORY_LABELS[row.original.category]
					: NOT_BENCHMARKED_LABEL,
			}),
	}),
	column.accessor((listing) => MACHINE_TIER_ORDER.indexOf(listing.tier), {
		id: 'tier',
		header: 'Tier',
		cell: ({ row }) => renderSnippet(tierCell, row.original),
	}),
	column.accessor('adminTierCap', {
		id: 'cap',
		header: 'Tier cap',
		cell: ({ row }) =>
			renderResourceLabel({
				label: row.original.adminTierCap
					? MACHINE_TIER_LABELS[row.original.adminTierCap]
					: NO_CAP_LABEL,
				sublabel: row.original.adminTierCapReason ?? undefined,
			}),
	}),
	column.accessor('datacenterApprovedAt', {
		id: 'datacenter',
		header: 'Datacenter',
		cell: ({ getValue }) => {
			const approvedAt = getValue();
			return renderResourceLabel(
				approvedAt ? timeCell(approvedAt) : { label: NOT_APPROVED_LABEL }
			);
		},
	}),
	column.accessor((listing) => listingFlags(listing).join(' · '), {
		id: 'flags',
		header: 'Flags',
		cell: ({ getValue }) => renderResourceLabel({ label: getValue() || null }),
	}),
	column.accessor((listing) => listing.measuredAt ?? '', {
		id: 'measured',
		header: 'Measured',
		cell: ({ row }) => renderResourceLabel(timeCell(row.original.measuredAt)),
	}),
	column.display({
		id: 'actions',
		header: 'Actions',
		meta: { variant: 'actions' },
		cell: ({ row }) => renderSnippet(actionsCell, row.original),
	}),
];

function listingActions(listing: AdminListing): ResourceRowAction[] {
	return [
		{
			icon: Pencil,
			label: 'Edit tier',
			onSelect: () => {
				editing = listing;
			},
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

{#snippet cpuIcon()}
	<Cpu />
{/snippet}

{#snippet tierCell(
	listing: AdminListing
)}
	<Badge size="sm" variant={tierBadgeVariant(listing.tier)}>
		{MACHINE_TIER_LABELS[listing.tier]}
	</Badge>
{/snippet}

{#snippet actionsCell(
	listing: AdminListing
)}
	<ResourceRowActions
		label={`${listing.machineId} actions`}
		actions={listingActions(listing)}
	/>
{/snippet}

{#snippet emptyState()}
	<AdminListEmpty
		search={controls.search.value}
		filterCount={controls.filterTags.length}
		onClear={controls.clearSearchAndFilters}
		title="Listings"
		description="Machines appear here once their host lists them on the marketplace."
	/>
{/snippet}

{#snippet panelActions()}
	{#if panel.row}
		{const listing = $derived(panel.row)}
		<IconButton
			variant="ghost"
			label="Edit tier"
			icon={Pencil}
			onclick={() => {
				editing = listing;
			}}
		/>
	{/if}
{/snippet}

{#snippet detailsPanel()}
	<ResourceDetailsPanel
		open={panel.row !== null}
		title="Listing details"
		onClose={panel.close}
		onPrevious={panel.previous}
		onNext={panel.next}
		actions={panelActions}
	>
		{#if panel.row}
			{const listing = $derived(panel.row)}
			<AdminRecordDetails
				summary={[
					{ label: 'Tier', content: listingTier },
					{
						label: 'Measured',
						value: listing.measuredAt
							? formatDateTime(listing.measuredAt)
							: null,
					},
				]}
				fields={[
					{ label: 'Machine', value: listing.machineId, mono: true },
					{
						label: 'Organization',
						value: listing.organizationId,
						mono: true,
					},
					{
						label: 'Category',
						value: listing.category
							? MACHINE_CATEGORY_LABELS[listing.category]
							: NOT_BENCHMARKED_LABEL,
					},
					{
						label: 'Tier cap',
						value: listing.adminTierCap
							? MACHINE_TIER_LABELS[listing.adminTierCap]
							: NO_CAP_LABEL,
					},
					{
						label: 'Datacenter approval',
						value: listing.datacenterApprovedAt
							? formatDateTime(listing.datacenterApprovedAt)
							: NOT_APPROVED_LABEL,
					},
					{
						label: 'Fingerprint conflict',
						value: listing.fingerprintConflict ? 'Yes' : 'No',
					},
					{
						label: 'Restricted',
						value: listing.restrictedAt
							? formatDateTime(listing.restrictedAt)
							: 'No',
					},
				]}
				notes={[
					{ label: 'Tier reasons', value: listing.tierReasons.join(' · ') },
					{ label: 'Tier cap reason', value: listing.adminTierCapReason },
					{ label: 'Restriction reason', value: listing.restrictionReason },
				]}
			/>
			{#snippet listingTier()}
				<Badge size="sm" variant={tierBadgeVariant(listing.tier)}>
					{MACHINE_TIER_LABELS[listing.tier]}
				</Badge>
			{/snippet}
		{/if}
	</ResourceDetailsPanel>
{/snippet}

<AdminListOptionsBar
	{controls}
	placeholder="Search listings..."
	ariaLabel="Search listings"
/>
<AdminTableContextMenu rowActions={listingRowActions}>
	<ResourceDataTable
		caption="Listings"
		{columns}
		data={listings}
		getRowId={(listing) => listing.machineId}
		rowLabel={(listing) => listing.machineId}
		sort={controls.sort}
		selectedRowId={panel.openId}
		isLoading={listingsQuery.isLoading}
		empty={emptyState}
		onRetry={() => void listingsQuery.refetch()}
		onRowClick={panel.open}
		onRowContextMenu={() => {}}
		hasMore={listingsQuery.hasNextPage}
		loadingMore={listingsQuery.isFetchingNextPage}
		onLoadMore={() => void listingsQuery.fetchNextPage()}
		overlay={detailsPanel}
		{...adminTableErrorProps(listingsQuery.error, 'Failed to load listings')}
	/>
</AdminTableContextMenu>
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
