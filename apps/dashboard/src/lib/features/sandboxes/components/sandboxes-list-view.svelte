<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import TerminalWindow from '#lib/components/icons/terminal-window.svelte';
import ResourceFilterChips from '#lib/components/resource/filter/resource-filter-chips.svelte';
import Resource from '#lib/components/resource/resource.svelte';
import ResourceHeader from '#lib/components/resource/resource-header.svelte';
import ResourceListEmpty from '#lib/components/resource/resource-list-empty.svelte';
import ResourceViewSwitch from '#lib/components/resource/resource-view-switch.svelte';
import TableFooter from '#lib/components/resource/table/table-footer.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import SandboxListFilters from '#lib/features/sandboxes/components/sandbox-list-filters.svelte';
import SandboxesListDialogs from '#lib/features/sandboxes/components/sandboxes-list-dialogs.svelte';
import SandboxesTable from '#lib/features/sandboxes/components/sandboxes-table.svelte';
import { SANDBOX_SEARCH_PLACEHOLDER } from '#lib/features/sandboxes/lib/sandboxes-list.ts';
import { SandboxesList } from '#lib/features/sandboxes/state/sandboxes-list.svelte.ts';
import { pluralize } from '#lib/utils/text.ts';

const list = new SandboxesList();
</script>

{#snippet filters()}
	<SandboxListFilters />
{/snippet}

{#snippet appliedFilters()}
	<div class="flex min-w-0 items-center gap-2 overflow-x-auto max-md:hidden">
		<ResourceFilterChips filterTags={list.filterTags} />
	</div>
{/snippet}

{#snippet toolbarControls()}
	{#if list.newCount > 0}
		<Chip size="compact" variant="secondary" onclick={list.showNew}>
			{`${list.newCount} new`}
		</Chip>
	{/if}
	<ResourceViewSwitch
		options={list.segments}
		value={list.view}
		onChange={list.changeView}
	/>
{/snippet}

{#snippet emptyState()}
	<ResourceListEmpty
		icon={TerminalWindow}
		message="No sandboxes yet"
		description="Sandboxes are isolated machines you start from a snapshot."
		search={list.appliedSearch}
		filterCount={list.narrowingCount}
		filters={list.narrowingTags}
		resource="sandboxes"
		onClear={list.clearSearchAndFilters}
		create={list.canWrite
			? {
					label: list.createLabel,
					onSelect: list.openCreate,
					disabled: list.createDisabledReason !== null,
					disabledReason: list.createDisabledReason ?? undefined,
				}
			: undefined}
	/>
{/snippet}

<Resource>
	<ResourceHeader
		title="Sandboxes"
		status={appliedFilters}
		search={{
			value: list.search.value,
			onChange: (value) => (list.search.value = value),
			placeholder: SANDBOX_SEARCH_PLACEHOLDER,
			ariaLabel: 'Search sandboxes',
		}}
		filter={{ active: list.filterTags.length > 0, content: filters }}
		sort={list.sortConfig}
		trailing={toolbarControls}
		create={{
			label: list.createLabel,
			onSelect: list.openCreate,
			disabled: list.createDisabledReason !== null,
			disabledReason: list.createDisabledReason ?? undefined,
		}}
	/>
	<SandboxesTable
		sandboxes={list.sandboxes}
		bind:selectedRowIds={list.selectedRowIds}
		sortConfig={list.sortConfig}
		isLoading={list.sandboxesQuery.isLoading}
		isFetching={list.sandboxesQuery.isFetching}
		isError={list.sandboxesQuery.isError}
		onRetry={() => void list.sandboxesQuery.refetch()}
		permissions={{ canWrite: list.canWrite, canDelete: list.canDelete }}
		empty={emptyState}
		onCreate={list.openCreate}
		onAction={list.runAction}
		onDelete={list.requestDelete}
		onOpenTerminal={list.openTerminal}
	/>
	{#if list.sandboxes.length > 0}
		<TableFooter
			label={pluralize(list.sandboxes.length, 'sandbox', 'sandboxes')}
			pagination={list.pagination}
		/>
	{/if}
</Resource>

<SandboxesListDialogs {list} />
