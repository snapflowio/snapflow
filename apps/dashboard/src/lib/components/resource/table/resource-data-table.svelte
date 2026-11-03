<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { RowData } from '@tanstack/svelte-table';
import type { Snippet } from 'svelte';
import type { ClassValue } from 'svelte/elements';
import type { ResourceBulkAction } from '#lib/components/resource/resource-bulk-action-bar.svelte';
import type {
	ResourceColumnDefs,
	ResourceTableSelection,
} from './resource-table-model.ts';
import type { ResourceSortState } from './resource-table-sort.ts';

interface ResourceDataTableProps<TData extends RowData> {
	columns: ResourceColumnDefs<TData>;
	data: readonly TData[];
	getRowId: (row: TData) => string;
	caption: string;
	rowLabel?: (row: TData) => string;
	rowClass?: (row: TData) => ClassValue;
	sort?: ResourceSortState;
	selectedRowId?: string | null;
	onRowClick?: (id: string) => void;
	onRowHover?: (id: string) => void;
	onRowContextMenu?: (event: MouseEvent, id: string) => void;
	isLoading?: boolean;
	errorMessage?: string;
	errorAction?: Snippet;
	emptyMessage?: string;
	empty?: Snippet;
	loadingMessage?: string;
	onRetry?: () => void;
	overlay?: Snippet;
	selection?: ResourceTableSelection<TData>;
	bulkActions?: readonly ResourceBulkAction[];
	onDeleteSelection?: (ids: string[]) => void;
	hasMore?: boolean;
	loadingMore?: boolean;
	onLoadMore?: () => void;
}

const DELETE_KEYS: ReadonlySet<string> = new Set(['Delete', 'Backspace']);
const SELECT_ALL_KEY = 'a';
</script>

<script lang="ts" generics="TData extends RowData">
import { on } from 'svelte/events';
import { MediaQuery } from 'svelte/reactivity';
import { breakpointQuery } from '#lib/components/layouts/breakpoints.ts';
import LoadMoreSentinel from '#lib/components/resource/load-more-sentinel.svelte';
import ResourceBulkActionBar from '#lib/components/resource/resource-bulk-action-bar.svelte';
import ScrollArea from '#lib/components/ui/scroll-area.svelte';
import { isEditableTarget, isModKey } from '#lib/utils/keyboard.ts';
import ResourceTableEmptyState from './resource-table-empty-state.svelte';
import ResourceTableHeader from './resource-table-header.svelte';
import ResourceTableRow from './resource-table-row.svelte';
import { ResourceTableState } from './resource-table-state.svelte.ts';

let {
	columns,
	data,
	getRowId,
	caption,
	rowLabel,
	rowClass,
	sort,
	selectedRowId,
	onRowClick,
	onRowHover,
	onRowContextMenu,
	isLoading = false,
	errorMessage,
	errorAction,
	emptyMessage,
	empty,
	loadingMessage,
	onRetry,
	overlay,
	selection,
	bulkActions = [],
	onDeleteSelection,
	hasMore = false,
	loadingMore = false,
	onLoadMore,
}: ResourceDataTableProps<TData> = $props();

const showAllColumns = new MediaQuery(breakpointQuery('sm'));
const tableState = new ResourceTableState<TData>(() => ({
	columns,
	data,
	getRowId,
	compact: !showAllColumns.current,
	sort,
	selection,
}));

const showLoadingState = $derived(isLoading && data.length === 0);

function handleKeydown(event: KeyboardEvent): void {
	if (!selection || event.defaultPrevented || isEditableTarget(event.target)) {
		return;
	}
	const selected = selection.selectedRowIds;
	if (isModKey(event) && event.key.toLowerCase() === SELECT_ALL_KEY) {
		event.preventDefault();
		tableState.selectAll();
	} else if (
		DELETE_KEYS.has(event.key) &&
		selected.length > 0 &&
		onDeleteSelection
	) {
		event.preventDefault();
		onDeleteSelection([...selected]);
	} else if (event.key === 'Escape' && selected.length > 0) {
		tableState.clearSelection();
	}
}
</script>

<svelte:document
	onpointerdown={tableState.clearContextMenuRow}
	onkeydown={tableState.clearContextMenuRowOnEscape}
/>

<div
	class="relative flex min-h-0 flex-1 flex-col overflow-hidden"
	{@attach (element) => on(element, 'keydown', handleKeydown)}
>
	<ScrollArea
		aria-label={`${caption} table`}
		class="@container/resource-table flex flex-1 flex-col overscroll-none scroll-pt-10"
	>
		<table
			aria-label={caption}
			aria-busy={isLoading}
			class="grid w-full shrink-0 text-small"
		>
			<ResourceTableHeader {tableState} {sort} />

			<tbody class="grid">
				{#each tableState.rows as tableRow (tableRow.id)}
					<ResourceTableRow
						{tableState}
						{tableRow}
						{selectedRowId}
						{rowClass}
						{rowLabel}
						{onRowClick}
						{onRowContextMenu}
						{onRowHover}
					/>
				{/each}
			</tbody>
		</table>
		{#if showLoadingState}
			<span role="status" class="sr-only">
				{loadingMessage ?? `Loading ${caption}`}
			</span>
		{/if}

		{#if hasMore && onLoadMore && data.length > 0}
			<LoadMoreSentinel loading={loadingMore} {onLoadMore} />
		{/if}

		{#if !isLoading && data.length === 0}
			{#if empty && !errorMessage}
				{@render empty()}
			{:else}
				<ResourceTableEmptyState
					{emptyMessage}
					{errorAction}
					{errorMessage}
					{onRetry}
				/>
			{/if}
		{/if}
	</ScrollArea>
	{@render overlay?.()}
</div>
{#if bulkActions.length > 0}
	<ResourceBulkActionBar
		selectedIds={selection?.selectedRowIds ?? []}
		actions={bulkActions}
	/>
{/if}
