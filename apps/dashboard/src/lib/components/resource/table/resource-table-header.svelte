<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" generics="TData extends RowData">
import {
	FlexRender,
	// biome-ignore lint/correctness/noUnusedImports: used by the generics attribute, which Biome does not read
	type RowData,
} from '@tanstack/svelte-table';
import Checkbox from '#lib/components/ui/checkbox/checkbox.svelte';
import {
	resourceCellPaddingClass,
	resourceHeaderCellClass,
	resourceTableHeaderClass,
} from './resource-table.ts';
import { resourceColumnLayout } from './resource-table-model.ts';
import { ariaSort, type ResourceSortState } from './resource-table-sort.ts';
import type { ResourceTableState } from './resource-table-state.svelte.ts';

interface ResourceTableHeaderProps {
	tableState: ResourceTableState<TData>;
	sort?: ResourceSortState;
}

let { tableState, sort }: ResourceTableHeaderProps = $props();

const headers = $derived(tableState.table.getHeaderGroups()[0]?.headers ?? []);
</script>

<thead class={['sticky top-0 z-10', resourceTableHeaderClass]}>
	<tr
		tabindex={-1}
		class="grid"
		style:grid-template-columns={tableState.gridTemplateColumns}
	>
		{#each headers as header (header.id)}
			{const layout = $derived(resourceColumnLayout(header.column))}
			{#if layout.variant === 'selection'}
				<th
					scope="col"
					tabindex={-1}
					class="flex h-10 items-center justify-center px-3 font-normal"
				>
					<Checkbox
						size="sm"
						aria-label="Select all visible rows"
						checked={tableState.selectAllState}
						disabled={!tableState.hasSelectableRows}
						onCheckedChange={(checked) =>
							tableState.table.toggleAllRowsSelected(Boolean(checked))}
					/>
				</th>
			{:else}
				<th
					scope="col"
					aria-sort={ariaSort(sort, layout.id)}
					tabindex={-1}
					class={[
						resourceHeaderCellClass,
						resourceCellPaddingClass(layout),
						'font-normal',
					]}
				>
					<span
						class={[
							'min-w-0 truncate',
							layout.variant === 'actions' && 'sr-only',
						]}
					>
						<FlexRender {header} />
					</span>
				</th>
			{/if}
		{/each}
	</tr>
</thead>
