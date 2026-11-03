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
import Resource from '#lib/components/resource/resource.svelte';
import ResourceChromeFallback from '#lib/components/resource/resource-chrome-fallback.svelte';
import ResourceHeader from '#lib/components/resource/resource-header.svelte';
import ResourceListEmpty from '#lib/components/resource/resource-list-empty.svelte';
import ResourceListFilter from '#lib/components/resource/resource-list-filter.svelte';
import ResourceOptionsBar from '#lib/components/resource/resource-options-bar.svelte';
import ResourceRowContextMenu from '#lib/components/resource/resource-row-context-menu.svelte';
import RegistriesListDialogs from '#lib/features/registries/components/registries-list-dialogs.svelte';
import RegistriesTable, {
	REGISTRY_COLUMN_LABELS,
} from '#lib/features/registries/components/registries-table.svelte';
import { REGISTRY_TYPE_OPTIONS } from '#lib/features/registries/lib/registries-list.ts';
import { RegistriesList } from '#lib/features/registries/state/registries-list.svelte.ts';

const list = new RegistriesList();
</script>

{#snippet typeFilter()}
	<ResourceListFilter
		label="Type"
		options={REGISTRY_TYPE_OPTIONS}
		value={list.types}
		onChange={list.setTypes}
		placeholder="All types"
	/>
{/snippet}

{#snippet emptyState()}
	<ResourceListEmpty
		title="Registries"
		description="Connect a container registry to pull private images into snapshots."
		create={{
			label: 'New registry',
			onSelect: list.openCreate,
			disabled: !list.canWrite,
		}}
		search={list.search.value}
		filterCount={list.types.length}
		onClear={list.clearSearchAndFilters}
	/>
{/snippet}

{#if list.registriesQuery.isPending}
	<ResourceChromeFallback
		icon={HexSimple}
		title="Registries"
		createLabel="New registry"
		searchPlaceholder="Search registries..."
		columns={REGISTRY_COLUMN_LABELS}
	/>
{:else}
	<Resource>
		<ResourceHeader
			icon={HexSimple}
			title="Registries"
			create={{
				label: 'New registry',
				onSelect: list.openCreate,
				disabled: !list.canWrite,
			}}
		/>
		<ResourceOptionsBar
			search={{
				value: list.search.value,
				onChange: (value) => (list.search.value = value),
				placeholder: 'Search registries...',
			}}
			filter={{ content: typeFilter, active: list.types.length > 0 }}
			filterTags={list.filterTags}
			onClearFilters={() => list.setTypes([])}
			sort={list.sortConfig}
		/>
		<ResourceRowContextMenu actionsFor={list.contextActions}>
			<RegistriesTable
				registries={list.registries}
				isError={list.registriesQuery.isError}
				onRetry={() => void list.registriesQuery.refetch()}
				onOpen={list.openRegistry}
				rowActions={list.rowActions}
				empty={emptyState}
			/>
		</ResourceRowContextMenu>
	</Resource>
{/if}

<RegistriesListDialogs {list} />
