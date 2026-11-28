<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ImageUp from '@lucide/svelte/icons/image';
import ResourceFilterChips from '#lib/components/resource/filter/resource-filter-chips.svelte';
import ResourceFilterPanel from '#lib/components/resource/filter/resource-filter-panel.svelte';
import Resource from '#lib/components/resource/resource.svelte';
import ResourceHeader, {
	type ResourceCreateAction,
} from '#lib/components/resource/resource-header.svelte';
import ResourceListEmpty from '#lib/components/resource/resource-list-empty.svelte';
import ResourceRowContextMenu from '#lib/components/resource/resource-row-context-menu.svelte';
import ResourceViewSwitch from '#lib/components/resource/resource-view-switch.svelte';
import SnapshotDetailsPanel from '#lib/features/snapshots/components/snapshot-details-panel.svelte';
import SnapshotsListDialogs from '#lib/features/snapshots/components/snapshots-list-dialogs.svelte';
import SnapshotsTable from '#lib/features/snapshots/components/snapshots-table.svelte';
import {
	SNAPSHOT_SEARCH_PLACEHOLDER,
	SNAPSHOT_STATE_OPTIONS,
} from '#lib/features/snapshots/lib/snapshots-list.ts';
import { SnapshotsList } from '#lib/features/snapshots/state/snapshots-list.svelte.ts';
import { pluralize } from '#lib/utils/text.ts';

const list = new SnapshotsList();
const create = $derived<ResourceCreateAction>({
	label: 'New snapshot',
	onSelect: list.openCreate,
	disabled: !list.canWrite,
	disabledReason: 'You need snapshot write access',
});
</script>

{#snippet filters()}
	<ResourceFilterPanel
		quickFields={[
			{
				id: 'state',
				label: 'State',
				options: SNAPSHOT_STATE_OPTIONS,
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
		icon={ImageUp}
		message="No snapshots yet"
		description="Snapshots are the images your sandboxes start from."
		{create}
		search={list.search.value}
		filterCount={list.narrowingTags.length}
		filters={list.narrowingTags}
		resource="snapshots"
		onClear={list.clearSearchAndFilters}
	/>
{/snippet}

<Resource>
	<ResourceHeader
		title="Snapshots"
		status={appliedFilters}
		search={{
			value: list.search.value,
			onChange: (value) => (list.search.value = value),
			placeholder: SNAPSHOT_SEARCH_PLACEHOLDER,
			ariaLabel: 'Search snapshots',
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
		<SnapshotsTable
			snapshots={list.pagination.rows}
			isLoading={list.snapshotsQuery.isPending}
			isError={list.snapshotsQuery.isError}
			onRetry={() => void list.snapshotsQuery.refetch()}
			selectable={list.canWrite || list.canDelete}
			bind:selectedRowIds={list.selection.ids}
			openSnapshotId={list.panel.openId}
			onOpen={list.panel.open}
			rowActions={list.rowActions}
			quickActions={list.quickActions}
			bulkActions={list.bulkActions}
			onDeleteSelection={list.canDelete ? list.confirmBulkDelete : undefined}
			sortConfig={list.sortConfig}
			pagination={list.pagination.config}
			footer={pluralize(list.snapshots.length, 'snapshot')}
			empty={emptyState}
		/>
	</ResourceRowContextMenu>
	<SnapshotDetailsPanel
		open={list.panel.row !== null}
		snapshot={list.panelSnapshot}
		actions={list.panelSnapshot ? list.rowActions(list.panelSnapshot) : []}
		onClose={list.panel.close}
		onPrevious={list.panel.previous}
		onNext={list.panel.next}
	/>
</Resource>

<SnapshotsListDialogs {list} />
