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
import ServerIcon from '@lucide/svelte/icons/server';
import { getWebsiteLinks } from '#lib/api/public-config.ts';
import EmptyState from '#lib/components/empty-state.svelte';
import Resource from '#lib/components/resource/resource.svelte';
import ResourceHeader from '#lib/components/resource/resource-header.svelte';
import ResourceOptionsBar from '#lib/components/resource/resource-options-bar.svelte';
import ResourceRefreshControl from '#lib/components/resource/resource-refresh-control.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import MachineListFilters from '#lib/features/machines/components/machine-list-filters.svelte';
import MachinesListDialogs from '#lib/features/machines/components/machines-list-dialogs.svelte';
import MachinesTable from '#lib/features/machines/components/machines-table.svelte';
import RowContextMenu from '#lib/features/machines/components/row-context-menu.svelte';
import { MachinesList } from '#lib/features/machines/state/machines-list.svelte.ts';

const list = new MachinesList();
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
	<MachineListFilters
		params={list.params}
		locationOptions={list.locationFilterOptions}
		onChange={list.updateFilters}
		onClear={list.clearFilters}
	/>
{/snippet}

{#snippet empty()}
	{#if list.hasQuery}
		{const trimmed = $derived(list.search.value.trim())}
		<EmptyState
			illustration={false}
			title={trimmed ? `No results for “${trimmed}”` : 'No results'}
		>
			{#snippet actions()}
				<Chip variant="border" onclick={list.clearQuery}>
					{trimmed && list.filterTags.length > 0
						? 'Clear search and filters'
						: trimmed
							? 'Clear search'
							: 'Clear filters'}
				</Chip>
			{/snippet}
		</EmptyState>
	{:else}
		<EmptyState
			title="No machines yet"
			description="Add a machine to run sandboxes on your own hardware."
		>
			{#snippet actions()}
				<Chip
					variant="primary"
					leftIcon={Plus}
					disabled={!list.canWrite}
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
	<ResourceHeader
		icon={ServerIcon}
		title="Machines"
		trailing={refreshControl}
		create={{
			label: 'Add machine',
			onSelect: list.openAdd,
			disabled: !list.canWrite,
		}}
	/>
	<ResourceOptionsBar
		search={{
			value: list.search.value,
			onChange: (value) => (list.search.value = value),
			placeholder: 'Search machines...',
			ariaLabel: 'Search machines',
		}}
		filterTags={list.filterTags}
		onClearFilters={list.clearFilters}
		filter={{ content: filterContent, active: list.filterTags.length > 0 }}
		sort={list.sortConfig}
	/>
	<RowContextMenu actions={list.contextActions} onTrigger={list.clearContext}>
		<MachinesTable
			machines={list.machines}
			onToggleScheduling={list.handlers.onToggleScheduling}
			onDrainingChange={list.handlers.onDrainingChange}
			onRevokeIdentity={list.handlers.onRevokeIdentity}
			onDelete={list.handlers.onDelete}
			sort={list.sort}
			{empty}
			isLoading={list.machinesQuery.isLoading}
			errorMessage={list.machinesQuery.isError
				? 'Failed to load machines'
				: undefined}
			onRetry={() => void list.machinesQuery.refetch()}
			onSelect={(machine) => list.openMachine(machine.id)}
			onRowContextMenu={list.retarget}
			selectable={list.canDelete}
			bind:selectedRowIds={list.selectedIds}
			bulkActions={list.bulkActions}
			onDeleteSelection={list.canDelete ? list.requestBulkDelete : undefined}
		/>
	</RowContextMenu>
</Resource>

<MachinesListDialogs {list} />
