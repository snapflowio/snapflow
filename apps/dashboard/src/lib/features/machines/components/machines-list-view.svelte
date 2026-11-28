<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Plus from '@lucide/svelte/icons/plus';
import ServerIcon from '@lucide/svelte/icons/server';
import { createQuery } from '@tanstack/svelte-query';
import { unmetDemandQueryOptions } from '#lib/api/listings.ts';
import EmptyState from '#lib/components/empty-state.svelte';
import ResourceFilterChips from '#lib/components/resource/filter/resource-filter-chips.svelte';
import Resource from '#lib/components/resource/resource.svelte';
import ResourceHeader from '#lib/components/resource/resource-header.svelte';
import ResourceNoResults from '#lib/components/resource/resource-no-results.svelte';
import ResourceRefreshControl from '#lib/components/resource/resource-refresh-control.svelte';
import ResourceRowContextMenu from '#lib/components/resource/resource-row-context-menu.svelte';
import ResourceViewSwitch from '#lib/components/resource/resource-view-switch.svelte';
import TableFooter from '#lib/components/resource/table/table-footer.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import MachineListFilters from '#lib/features/machines/components/machine-list-filters.svelte';
import MachinesListDialogs from '#lib/features/machines/components/machines-list-dialogs.svelte';
import MachinesTable from '#lib/features/machines/components/machines-table.svelte';
import { unmetDemandLine } from '#lib/features/machines/lib/unmet-demand.ts';
import { MachinesList } from '#lib/features/machines/state/machines-list.svelte.ts';
import { pluralize } from '#lib/utils/text.ts';

const WRITE_REQUIRED = 'Ask a member who manages machines';
const FIRST_RUN_LINE =
	'Add a machine to run your own sandboxes on it, or list it on the marketplace.';

const list = new MachinesList();
const demand = createQuery(() => ({
	...unmetDemandQueryOptions(),
	enabled: list.showsListing,
}));
const demandLine = $derived(
	demand.data?.[0]
		? `${unmetDemandLine(demand.data[0])} went unserved this week.`
		: null
);
const footer = $derived(
	list.machines.length > 0 ? pluralize(list.machines.length, 'machine') : null
);
</script>

{#snippet filterContent()}
	<MachineListFilters
		params={list.params}
		locationOptions={list.locationFilterOptions}
		showsListing={list.showsListing}
		onChange={list.updateFilters}
		onClear={list.clearFilters}
	/>
{/snippet}

{#snippet leading()}
	<div class="flex min-w-0 items-center gap-2 overflow-x-auto scrollbar-none">
		<ResourceFilterChips
			filterTags={list.filterTags}
			onClearFilters={list.clearFilters}
		/>
	</div>
{/snippet}

{#snippet trailing()}
	{#if list.segments.length > 1}
		<ResourceViewSwitch
			options={list.segments}
			value={list.params.view}
			onChange={list.setView}
		/>
	{/if}
	<div class="hidden md:contents">
		<ResourceRefreshControl
			isRefreshing={list.machinesQuery.isFetching}
			onIntervalChange={(interval) => (list.refreshInterval = interval)}
			onRefresh={() => void list.machinesQuery.refetch()}
			value={list.refreshInterval}
		/>
	</div>
{/snippet}

{#snippet empty()}
	{#if list.hasQuery || list.hasMachines}
		<ResourceNoResults
			search={list.search.value}
			filterCount={list.filterTags.length}
			filters={list.filterTags}
			resource="machines"
			onClear={list.clearQuery}
		/>
	{:else}
		<EmptyState icon={ServerIcon} bordered={false} title="No machines yet">
			<p>{demandLine ?? FIRST_RUN_LINE}</p>
			{#snippet actions()}
				<Chip
					variant="secondary"
					leftIcon={Plus}
					disabledReason={list.canWrite ? undefined : WRITE_REQUIRED}
					onclick={list.openAdd}
				>
					Add machine
				</Chip>
			{/snippet}
		</EmptyState>
	{/if}
{/snippet}

<Resource>
	<ResourceHeader
		title="Machines"
		status={leading}
		search={{
			value: list.search.value,
			onChange: (value) => (list.search.value = value),
			placeholder: 'Search machines',
		}}
		filter={{ content: filterContent, active: list.filterTags.length > 0 }}
		sort={list.sortConfig}
		{trailing}
		create={{
			label: 'Add machine',
			onSelect: list.openAdd,
			disabled: !list.canWrite,
			disabledReason: WRITE_REQUIRED,
		}}
		pending={list.machinesQuery.isFetching && !list.machinesQuery.isLoading}
	/>
	<ResourceRowContextMenu actionsFor={list.contextActions}>
		<MachinesTable
			machines={list.machines}
			hosts={list.hostsById}
			earned={list.earnedById}
			showsListing={list.showsListing}
			showsEarnings={list.showsEarnings}
			onToggleScheduling={list.handlers.onToggleScheduling}
			onDrainingChange={list.handlers.onDrainingChange}
			onRevokeIdentity={list.handlers.onRevokeIdentity}
			onDelete={list.handlers.onDelete}
			sortConfig={list.sortConfig}
			{empty}
			isLoading={list.machinesQuery.isLoading}
			isFetching={list.machinesQuery.isFetching}
			errorMessage={list.machinesQuery.isError
				? "Couldn't load machines"
				: undefined}
			onRetry={() => void list.machinesQuery.refetch()}
			onSelect={(machine) => list.openMachine(machine.id)}
			onOpenHealth={list.openHealth}
			onRowContextMenu={list.retarget}
			selectable={list.canDelete}
			bind:selectedRowIds={list.selectedIds}
			bulkActions={list.bulkActions}
			onDeleteSelection={list.canDelete ? list.requestBulkDelete : undefined}
		/>
	</ResourceRowContextMenu>
	{#if footer}
		<TableFooter label={footer} />
	{/if}
</Resource>

<MachinesListDialogs {list} />
