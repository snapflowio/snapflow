<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import HexSimple from '#lib/components/icons/hex-simple.svelte';
import ResourceFilterChips from '#lib/components/resource/filter/resource-filter-chips.svelte';
import ResourceFilterPanel from '#lib/components/resource/filter/resource-filter-panel.svelte';
import Resource from '#lib/components/resource/resource.svelte';
import ResourceHeader, {
	type ResourceCreateAction,
} from '#lib/components/resource/resource-header.svelte';
import ResourceListEmpty from '#lib/components/resource/resource-list-empty.svelte';
import ResourceRowContextMenu from '#lib/components/resource/resource-row-context-menu.svelte';
import RegistriesListDialogs from '#lib/features/registries/components/registries-list-dialogs.svelte';
import RegistriesTable from '#lib/features/registries/components/registries-table.svelte';
import RegistryDetailsPanel from '#lib/features/registries/components/registry-details-panel.svelte';
import { REGISTRY_TYPE_OPTIONS } from '#lib/features/registries/lib/registries-list.ts';
import { RegistriesList } from '#lib/features/registries/state/registries-list.svelte.ts';
import { pluralize } from '#lib/utils/text.ts';

const SEARCH_PLACEHOLDER = 'Search registries...';

const list = new RegistriesList();
const create = $derived<ResourceCreateAction>({
	label: 'New registry',
	onSelect: list.openCreate,
	disabled: !list.canWrite,
	disabledReason: 'You need registry write access',
});
</script>

{#snippet filters()}
	<ResourceFilterPanel
		quickFields={[
			{
				id: 'type',
				label: 'Type',
				options: REGISTRY_TYPE_OPTIONS,
				values: list.types,
				onChange: list.setTypes,
			},
		]}
	/>
{/snippet}

{#snippet appliedFilters()}
	<div class="flex min-w-0 items-center gap-2 overflow-x-auto max-md:hidden">
		<ResourceFilterChips filterTags={list.filterTags} />
	</div>
{/snippet}

{#snippet emptyState()}
	<ResourceListEmpty
		icon={HexSimple}
		message="No registries yet"
		description="Add a registry to pull private images into snapshots."
		{create}
		search={list.search.value}
		filterCount={list.filterTags.length}
		filters={list.filterTags}
		resource="registries"
		onClear={list.clearSearchAndFilters}
	/>
{/snippet}

<Resource>
	<ResourceHeader
		title="Registries"
		status={appliedFilters}
		search={{
			value: list.search.value,
			onChange: (value) => (list.search.value = value),
			placeholder: SEARCH_PLACEHOLDER,
			ariaLabel: 'Search registries',
		}}
		filter={{ active: list.filterTags.length > 0, content: filters }}
		sort={list.sortConfig}
		{create}
	/>
	<ResourceRowContextMenu actionsFor={list.contextActions}>
		<RegistriesTable
			registries={list.pagination.rows}
			isLoading={list.registriesQuery.isPending}
			isError={list.registriesQuery.isError}
			onRetry={() => void list.registriesQuery.refetch()}
			openRegistryId={list.panel.openId}
			onOpen={list.panel.open}
			rowActions={list.rowActions}
			sortConfig={list.sortConfig}
			pagination={list.pagination.config}
			footer={pluralize(list.registries.length, 'registry', 'registries')}
			empty={emptyState}
		/>
	</ResourceRowContextMenu>
	<RegistryDetailsPanel
		open={list.panel.row !== null}
		registry={list.panelRegistry}
		actions={list.panelRegistry ? list.rowActions(list.panelRegistry) : []}
		onClose={list.panel.close}
		onPrevious={list.panel.previous}
		onNext={list.panel.next}
	/>
</Resource>

<RegistriesListDialogs {list} />
