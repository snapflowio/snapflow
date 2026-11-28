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
import ResourceFilterChips from '#lib/components/resource/filter/resource-filter-chips.svelte';
import ResourceFilterPanel from '#lib/components/resource/filter/resource-filter-panel.svelte';
import Resource from '#lib/components/resource/resource.svelte';
import ResourceHeader, {
	type ResourceCreateAction,
} from '#lib/components/resource/resource-header.svelte';
import ResourceListEmpty from '#lib/components/resource/resource-list-empty.svelte';
import ResourceRowContextMenu from '#lib/components/resource/resource-row-context-menu.svelte';
import ResourceViewSwitch from '#lib/components/resource/resource-view-switch.svelte';
import VolumeDetailsPanel from '#lib/features/volumes/components/volume-details-panel.svelte';
import VolumesListDialogs from '#lib/features/volumes/components/volumes-list-dialogs.svelte';
import VolumesTable from '#lib/features/volumes/components/volumes-table.svelte';
import {
	VOLUME_SEARCH_PLACEHOLDER,
	VOLUME_STATE_OPTIONS,
} from '#lib/features/volumes/lib/volumes-list.ts';
import { VolumesList } from '#lib/features/volumes/state/volumes-list.svelte.ts';
import { pluralize } from '#lib/utils/text.ts';

const list = new VolumesList();
const create = $derived<ResourceCreateAction>({
	label: 'New volume',
	onSelect: list.openCreate,
	disabled: !list.canWrite,
	disabledReason: 'You need volume write access',
});
</script>

{#snippet filters()}
	<ResourceFilterPanel
		quickFields={[
			{
				id: 'state',
				label: 'State',
				options: VOLUME_STATE_OPTIONS,
				values: list.states,
				onChange: list.setStates,
			},
		]}
	/>
{/snippet}

{#snippet appliedFilters()}
	<div class="flex min-w-0 items-center gap-2 overflow-x-auto max-md:hidden">
		<ResourceFilterChips filterTags={list.filterTags} />
	</div>
{/snippet}

{#snippet viewSwitch()}
	<ResourceViewSwitch
		options={list.segments}
		value={list.view}
		onChange={list.changeView}
	/>
{/snippet}

{#snippet emptyState()}
	<ResourceListEmpty
		icon={Database}
		message="No volumes yet"
		description="Volumes keep data that outlives a sandbox."
		{create}
		search={list.search.value}
		filterCount={list.narrowingTags.length}
		filters={list.narrowingTags}
		resource="volumes"
		onClear={list.clearSearchAndFilters}
	/>
{/snippet}

<Resource>
	<ResourceHeader
		title="Volumes"
		status={appliedFilters}
		search={{
			value: list.search.value,
			onChange: (value) => (list.search.value = value),
			placeholder: VOLUME_SEARCH_PLACEHOLDER,
			ariaLabel: 'Search volumes',
		}}
		filter={{ active: list.filterTags.length > 0, content: filters }}
		sort={list.sortConfig}
		trailing={viewSwitch}
		{create}
	/>
	<ResourceRowContextMenu
		actionsFor={list.contextActions}
		onTarget={list.selection.retarget}
	>
		<VolumesTable
			volumes={list.pagination.rows}
			isLoading={list.volumesQuery.isPending}
			isError={list.volumesQuery.isError}
			onRetry={() => void list.volumesQuery.refetch()}
			selectable={list.canDelete}
			bind:selectedRowIds={list.selection.ids}
			openVolumeId={list.panel.openId}
			onOpen={list.panel.open}
			rowActions={list.rowActions}
			bulkActions={list.bulkActions}
			onDeleteSelection={list.canDelete ? list.confirmBulkDelete : undefined}
			sortConfig={list.sortConfig}
			pagination={list.pagination.config}
			footer={pluralize(list.volumes.length, 'volume')}
			empty={emptyState}
		/>
	</ResourceRowContextMenu>
	<VolumeDetailsPanel
		open={list.panel.row !== null}
		volume={list.panelVolume}
		actions={list.panelVolume ? list.rowActions(list.panelVolume) : []}
		onClose={list.panel.close}
		onPrevious={list.panel.previous}
		onNext={list.panel.next}
	/>
</Resource>

<VolumesListDialogs {list} />
