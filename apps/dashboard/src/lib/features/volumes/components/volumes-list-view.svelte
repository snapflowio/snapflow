<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Database from '@lucide/svelte/icons/database';
import Resource from '#lib/components/resource/resource.svelte';
import ResourceChromeFallback from '#lib/components/resource/resource-chrome-fallback.svelte';
import ResourceHeader from '#lib/components/resource/resource-header.svelte';
import ResourceListEmpty from '#lib/components/resource/resource-list-empty.svelte';
import ResourceListFilter from '#lib/components/resource/resource-list-filter.svelte';
import ResourceOptionsBar from '#lib/components/resource/resource-options-bar.svelte';
import ResourceRowContextMenu from '#lib/components/resource/resource-row-context-menu.svelte';
import VolumesListDialogs from '#lib/features/volumes/components/volumes-list-dialogs.svelte';
import VolumesTable, {
	VOLUME_COLUMN_LABELS,
} from '#lib/features/volumes/components/volumes-table.svelte';
import { VOLUME_STATE_OPTIONS } from '#lib/features/volumes/lib/volumes-list.ts';
import { VolumesList } from '#lib/features/volumes/state/volumes-list.svelte.ts';

const list = new VolumesList();
</script>

{#snippet stateFilter()}
	<ResourceListFilter
		label="State"
		options={VOLUME_STATE_OPTIONS}
		value={list.states}
		onChange={list.setStates}
		placeholder="All states"
	/>
{/snippet}

{#snippet emptyState()}
	<ResourceListEmpty
		title="Volumes"
		description="Create a volume to persist data across sandboxes."
		create={{
			label: 'New volume',
			onSelect: list.openCreate,
			disabled: !list.canWrite,
		}}
		search={list.search.value}
		filterCount={list.states.length}
		onClear={list.clearSearchAndFilters}
	/>
{/snippet}

{#if list.volumesQuery.isPending}
	<ResourceChromeFallback
		icon={Database}
		title="Volumes"
		createLabel="New volume"
		searchPlaceholder="Search volumes..."
		columns={VOLUME_COLUMN_LABELS}
	/>
{:else}
	<Resource>
		<ResourceHeader
			icon={Database}
			title="Volumes"
			create={{
				label: 'New volume',
				onSelect: list.openCreate,
				disabled: !list.canWrite,
			}}
		/>
		<ResourceOptionsBar
			search={{
				value: list.search.value,
				onChange: (value) => (list.search.value = value),
				placeholder: 'Search volumes...',
			}}
			filter={{ content: stateFilter, active: list.states.length > 0 }}
			filterTags={list.filterTags}
			onClearFilters={() => list.setStates([])}
			sort={list.sortConfig}
		/>
		<ResourceRowContextMenu
			actionsFor={list.contextActions}
			onTarget={list.selection.retarget}
		>
			<VolumesTable
				volumes={list.volumes}
				isError={list.volumesQuery.isError}
				onRetry={() => void list.volumesQuery.refetch()}
				selectable={list.canDelete}
				bind:selectedRowIds={list.selection.ids}
				rowActions={list.rowActions}
				bulkActions={list.bulkActions}
				onDeleteSelection={list.canDelete ? list.confirmBulkDelete : undefined}
				empty={emptyState}
			/>
		</ResourceRowContextMenu>
	</Resource>
{/if}

<VolumesListDialogs {list} />
