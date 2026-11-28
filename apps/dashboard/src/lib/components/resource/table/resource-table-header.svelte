<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const SORT_BUTTON_CLASS =
	'group/sort inline-flex min-w-0 cursor-pointer items-center gap-1 rounded-md outline-none transition-colors duration-(--motion-quick) hover-hover:text-(--text-primary) focus-visible:focus-ring';
const SORT_ICON_CLASS = 'size-3 shrink-0 transition-opacity';
</script>

<script lang="ts" generics="TData extends RowData">
import ArrowDown from '@lucide/svelte/icons/arrow-down';
import ArrowUp from '@lucide/svelte/icons/arrow-up';
import ArrowUpDown from '@lucide/svelte/icons/arrow-up-down';
import { FlexRender, type RowData } from '@tanstack/svelte-table';
import {
	nextSortDirection,
	type ResourceSortConfig,
} from '#lib/components/resource/resource-options.ts';
import Checkbox from '#lib/components/ui/checkbox/checkbox.svelte';
import {
	RESOURCE_TABLE_VARIANT,
	resourceCellPaddingClass,
} from './resource-table.ts';
import { resourceColumnLayout } from './resource-table-model.ts';
import { ariaSort, type ResourceSortState } from './resource-table-sort.ts';
import type { ResourceTableState } from './resource-table-state.svelte.ts';

interface ResourceTableHeaderProps {
	tableState: ResourceTableState<TData>;
	sort?: ResourceSortState;
	sortConfig?: ResourceSortConfig;
	refetching?: boolean;
}

let {
	tableState,
	sort,
	sortConfig,
	refetching = false,
}: ResourceTableHeaderProps = $props();

const headers = $derived(tableState.table.getHeaderGroups()[0]?.headers ?? []);
const variantClasses = $derived(RESOURCE_TABLE_VARIANT[tableState.variant]);
const sortableIds = $derived(
	new Set(sortConfig?.options.map((option) => option.id) ?? [])
);

function toggleSort(columnId: string): void {
	if (!sortConfig) return;
	sortConfig.onSort(columnId, nextSortDirection(sortConfig.active, columnId));
}
</script>

<thead class={['sticky top-0 z-10', variantClasses.header]}>
	{#if refetching}
		<tr
			aria-hidden="true"
			class="pointer-events-none absolute inset-x-0 -bottom-0.5 h-0.5 overflow-hidden"
		>
			<td class="block h-full w-full">
				<span
					class="refetch-sweep block h-full w-1/3 bg-(--text-primary)/40"
				></span>
			</td>
		</tr>
	{/if}
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
					class={[variantClasses.headerCell, 'justify-center pl-4 font-normal']}
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
				{const direction = $derived(ariaSort(sort, layout.id))}
				<th
					scope="col"
					aria-sort={direction}
					tabindex={-1}
					class={[
						variantClasses.headerCell,
						resourceCellPaddingClass(layout, tableState.variant),
						'font-normal',
					]}
				>
					{#if sortConfig &&
						sortableIds.has(layout.id) &&
						layout.variant !== 'actions'}
						<button
							type="button"
							class={[
								SORT_BUTTON_CLASS,
								layout.align === 'end' && 'flex-row-reverse',
								direction && 'text-(--text-primary)',
							]}
							onclick={() => toggleSort(layout.id)}
						>
							<span class="min-w-0 truncate"><FlexRender {header} /></span>
							{#if direction === 'ascending'}
								<ArrowUp class={SORT_ICON_CLASS} />
							{:else if direction === 'descending'}
								<ArrowDown class={SORT_ICON_CLASS} />
							{:else}
								<ArrowUpDown
									class={[
										SORT_ICON_CLASS,
										'opacity-0 group-hover/sort:opacity-100 group-focus-visible/sort:opacity-100',
									]}
								/>
							{/if}
						</button>
					{:else}
						<span
							class={[
								'min-w-0 truncate',
								layout.variant === 'actions' && 'sr-only',
							]}
						>
							<FlexRender {header} />
						</span>
					{/if}
				</th>
			{/if}
		{/each}
	</tr>
</thead>
