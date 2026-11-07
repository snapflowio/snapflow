<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import BookOpen from '@lucide/svelte/icons/book-open';
import Plus from '@lucide/svelte/icons/plus';
import { PayoutReadiness } from '@snapflow/api-client';
import { getWebsiteLinks } from '#lib/api/public-config.ts';
import EmptyState from '#lib/components/empty-state.svelte';
import Resource from '#lib/components/resource/resource.svelte';
import ResourceOptionsBar from '#lib/components/resource/resource-options-bar.svelte';
import ResourceRefreshControl from '#lib/components/resource/resource-refresh-control.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ListingHeader from '#lib/features/listings/components/listing-header.svelte';
import HostListingFilters from '#lib/features/listings/components/mine/host-listing-filters.svelte';
import HostListingModals from '#lib/features/listings/components/mine/host-listing-modals.svelte';
import HostListingsTable from '#lib/features/listings/components/mine/host-listings-table.svelte';
import PayoutSetupBanner from '#lib/features/listings/components/mine/payout-setup-banner.svelte';
import { HostListingsList } from '#lib/features/listings/state/host-listings-list.svelte.ts';
import AddMachineModal from '#lib/features/machines/components/add-machine-modal.svelte';
import RowContextMenu from '#lib/features/machines/components/row-context-menu.svelte';
import OrganizationPermissionGate from '#lib/features/organizations/components/organization-permission-gate.svelte';

const list = new HostListingsList();
const { docsHref } = getWebsiteLinks();
</script>

{#snippet refreshControl()}
	<ResourceRefreshControl
		isRefreshing={list.machinesQuery.isFetching}
		onIntervalChange={(interval) => (list.refreshInterval = interval)}
		onRefresh={() => void list.machinesQuery.refetch()}
		value={list.refreshInterval}
	/>
{/snippet}

{#snippet filterContent()}
	<HostListingFilters
		params={list.params}
		onChange={list.updateFilters}
		onClear={list.clearFilters}
	/>
{/snippet}

{#snippet empty()}
	{#if list.hasQuery}
		<EmptyState
			illustration={false}
			title={list.trimmedSearch
				? `No results for “${list.trimmedSearch}”`
				: 'No results'}
		>
			{#snippet actions()}
				<Chip variant="border" onclick={list.clearQuery}>
					{list.trimmedSearch && list.filterTags.length > 0
						? 'Clear search and filters'
						: list.trimmedSearch
							? 'Clear search'
							: 'Clear filters'}
				</Chip>
			{/snippet}
		</EmptyState>
	{:else}
		<EmptyState
			title="No listings yet"
			description="Add a machine to list it on the marketplace."
		>
			{#snippet actions()}
				<Chip
					variant="primary"
					leftIcon={Plus}
					disabled={!list.canAddMachine}
					onclick={list.openAdd}
				>
					Add machine
				</Chip>
				<Chip
					variant="border"
					leftIcon={BookOpen}
					href={docsHref}
					target="_blank"
					rel="noopener noreferrer"
				>
					Docs
				</Chip>
			{/snippet}
		</EmptyState>
	{/if}
{/snippet}

<Resource>
	<ListingHeader
		trailing={list.canRead ? refreshControl : undefined}
		create={{
			label: 'Add machine',
			onSelect: list.openAdd,
			disabled: !list.canAddMachine,
		}}
	/>
	<OrganizationPermissionGate
		label="listings"
		permission={{ listings: ['read'] }}
	>
		{#if list.payout.readiness !== undefined &&
			list.payout.readiness !== PayoutReadiness.Ready}
			<PayoutSetupBanner
				readiness={list.payout.readiness}
				canManage={list.payout.canManage}
			/>
		{/if}
		<ResourceOptionsBar
			search={{
				value: list.search.value,
				onChange: (value) => (list.search.value = value),
				placeholder: 'Search listings...',
				ariaLabel: 'Search listings',
			}}
			filterTags={list.filterTags}
			onClearFilters={list.clearFilters}
			filter={{ content: filterContent, active: list.filterTags.length > 0 }}
			sort={list.sortConfig}
		/>
		<RowContextMenu actions={list.contextActions} onTrigger={list.clearContext}>
			<HostListingsTable
				machines={list.machines}
				rowActions={list.rowActions}
				sort={list.sort}
				{empty}
				isLoading={list.machinesQuery.isLoading}
				errorMessage={list.machinesQuery.isError &&
				list.machinesQuery.data === undefined
					? 'Failed to load your listings'
					: undefined}
				onRetry={() => void list.machinesQuery.refetch()}
				onSelect={list.openListing}
				onRowContextMenu={list.retarget}
				selectable={list.canWrite}
				bind:selectedRowIds={list.selectedIds}
				bulkActions={list.bulkActions}
			/>
		</RowContextMenu>
	</OrganizationPermissionGate>
</Resource>

<AddMachineModal bind:open={list.addOpen} />
<HostListingModals
	bind:listing={list.listing}
	bind:pricing={list.pricing}
	payoutReady={list.payout.ready}
/>
