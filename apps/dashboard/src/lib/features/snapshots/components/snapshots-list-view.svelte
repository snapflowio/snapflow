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
import Resource from '#lib/components/resource/resource.svelte';
import ResourceChromeFallback from '#lib/components/resource/resource-chrome-fallback.svelte';
import ResourceHeader from '#lib/components/resource/resource-header.svelte';
import ResourceListEmpty from '#lib/components/resource/resource-list-empty.svelte';
import ResourceListFilter from '#lib/components/resource/resource-list-filter.svelte';
import ResourceOptionsBar from '#lib/components/resource/resource-options-bar.svelte';
import ResourceRowContextMenu from '#lib/components/resource/resource-row-context-menu.svelte';
import SnapshotDetailsPanel from '#lib/features/snapshots/components/snapshot-details-panel.svelte';
import SnapshotsListDialogs from '#lib/features/snapshots/components/snapshots-list-dialogs.svelte';
import SnapshotsTable, {
	SNAPSHOT_COLUMN_LABELS,
} from '#lib/features/snapshots/components/snapshots-table.svelte';
import { SNAPSHOT_STATE_OPTIONS } from '#lib/features/snapshots/lib/snapshots-list.ts';
import { SnapshotsList } from '#lib/features/snapshots/state/snapshots-list.svelte.ts';

const list = new SnapshotsList();
</script>

{#snippet stateFilter()}
	<ResourceListFilter
		label="State"
		options={SNAPSHOT_STATE_OPTIONS}
		value={list.states}
		onChange={list.setStates}
		placeholder="All states"
	/>
{/snippet}

{#snippet emptyState()}
	<ResourceListEmpty
		title="Snapshots"
		description="Create a snapshot to start sandboxes from a container image."
		create={{
			label: 'New snapshot',
			onSelect: list.openCreate,
			disabled: !list.canWrite,
		}}
		search={list.search.value}
		filterCount={list.states.length}
		onClear={list.clearSearchAndFilters}
	/>
{/snippet}

{#snippet detailsPanel()}
	<SnapshotDetailsPanel
		open={list.panel.row !== null}
		snapshot={list.panelSnapshot}
		actions={list.panelSnapshot ? list.rowActions(list.panelSnapshot) : []}
		onClose={list.panel.close}
		onPrevious={list.panel.previous}
		onNext={list.panel.next}
	/>
{/snippet}

{#if list.snapshotsQuery.isPending}
	<ResourceChromeFallback
		icon={ImageUp}
		title="Snapshots"
		createLabel="New snapshot"
		searchPlaceholder="Search snapshots..."
		columns={SNAPSHOT_COLUMN_LABELS}
	/>
{:else}
	<Resource>
		<ResourceHeader
			icon={ImageUp}
			title="Snapshots"
			create={{
				label: 'New snapshot',
				onSelect: list.openCreate,
				disabled: !list.canWrite,
			}}
		/>
		<ResourceOptionsBar
			search={{
				value: list.search.value,
				onChange: (value) => (list.search.value = value),
				placeholder: 'Search snapshots...',
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
			<SnapshotsTable
				snapshots={list.snapshots}
				isError={list.snapshotsQuery.isError}
				onRetry={() => void list.snapshotsQuery.refetch()}
				selectable={list.canWrite || list.canDelete}
				bind:selectedRowIds={list.selection.ids}
				openSnapshotId={list.panel.openId}
				onOpen={list.panel.open}
				rowActions={list.rowActions}
				bulkActions={list.bulkActions}
				onDeleteSelection={list.canDelete ? list.confirmBulkDelete : undefined}
				empty={emptyState}
				overlay={detailsPanel}
			/>
		</ResourceRowContextMenu>
	</Resource>
{/if}

<SnapshotsListDialogs {list} />
