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
import type { IconComponent } from '#lib/components/icons/icon-component.ts';
import type { ResourceBulkAction } from '#lib/components/resource/resource-bulk-action-bar.svelte';
import type { ResourceSortConfig } from '#lib/components/resource/resource-options.ts';
import type { ResourcePaginationConfig } from '#lib/components/resource/resource-pagination.ts';
import type { ResourceTableVariant } from './resource-table.ts';
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
	rowDimmed?: (row: TData) => boolean;
	sort?: ResourceSortState;
	sortConfig?: ResourceSortConfig;
	sortedByServer?: boolean;
	variant?: ResourceTableVariant;
	pagination?: ResourcePaginationConfig;
	footer?: string;
	selectedRowId?: string | null;
	onRowClick?: (id: string) => void;
	onRowHover?: (id: string) => void;
	rowContextMenu?: boolean;
	onRowContextMenu?: (event: MouseEvent, id: string) => void;
	isLoading?: boolean;
	isFetching?: boolean;
	errorMessage?: string;
	errorAction?: Snippet;
	emptyMessage?: string;
	emptyIcon?: IconComponent;
	empty?: Snippet;
	loadingMessage?: string;
	onRetry?: () => void;
	overlay?: Snippet;
	selection?: ResourceTableSelection<TData>;
	bulkActions?: readonly ResourceBulkAction[];
	onDeleteSelection?: (ids: string[]) => void;
	onPartialFailure?: (failedIds: string[]) => void;
	hasMore?: boolean;
	loadingMore?: boolean;
	onLoadMore?: () => void;
}

const DELETE_KEYS: ReadonlySet<string> = new Set(['Delete', 'Backspace']);
const SELECT_ALL_KEY = 'a';
</script>

<script lang="ts" generics="TData extends RowData">
import { ElementSize } from 'runed';
import { on } from 'svelte/events';
import { MediaQuery } from 'svelte/reactivity';
import { breakpointQuery } from '#lib/components/layouts/breakpoints.ts';
import LoadMoreSentinel from '#lib/components/resource/load-more-sentinel.svelte';
import ResourceBulkActionBar from '#lib/components/resource/resource-bulk-action-bar.svelte';
import ScrollArea from '#lib/components/ui/scroll-area.svelte';
import { isEditableTarget, isModKey } from '#lib/utils/keyboard.ts';
import { RESOURCE_TABLE_VARIANT } from './resource-table.ts';
import ResourceTableEmptyState from './resource-table-empty-state.svelte';
import ResourceTableHeader from './resource-table-header.svelte';
import ResourceTableRow from './resource-table-row.svelte';
import ResourceTableSkeleton from './resource-table-skeleton.svelte';
import { ResourceTableState } from './resource-table-state.svelte.ts';
import TableFooter from './table-footer.svelte';

let {
	columns,
	data,
	getRowId,
	caption,
	rowLabel,
	rowClass,
	rowDimmed,
	sort: sortState,
	sortConfig,
	sortedByServer = false,
	variant = 'condensed',
	pagination,
	footer,
	selectedRowId,
	onRowClick,
	onRowHover,
	rowContextMenu = false,
	onRowContextMenu,
	isLoading = false,
	isFetching = false,
	errorMessage,
	errorAction,
	emptyMessage,
	emptyIcon,
	empty,
	loadingMessage,
	onRetry,
	overlay,
	selection,
	bulkActions = [],
	onDeleteSelection,
	onPartialFailure,
	hasMore = false,
	loadingMore = false,
	onLoadMore,
}: ResourceDataTableProps<TData> = $props();

const showAllColumns = new MediaQuery(breakpointQuery('sm'));
let frame = $state<HTMLElement>();
const frameSize = new ElementSize(() => frame);
const sort = $derived(sortState ?? sortConfig?.active ?? undefined);
const variantClasses = $derived(RESOURCE_TABLE_VARIANT[variant]);
const tableState = new ResourceTableState<TData>(() => ({
	columns,
	data,
	getRowId,
	compact: !showAllColumns.current,
	width: frameSize.width,
	sort,
	sortedByServer,
	selection,
	variant,
}));

const showLoadingState = $derived(isLoading && data.length === 0);
const showRefetch = $derived(isFetching && data.length > 0);
const showEmptySnippet = $derived(
	Boolean(empty) && !errorMessage && !isLoading && data.length === 0
);
const columnCount = $derived(
	tableState.table.getHeaderGroups()[0]?.headers.length ?? 0
);

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
	bind:this={frame}
	class={[
		'relative flex min-h-0 flex-col overflow-hidden',
		variant === 'framed' ? 'flex-initial' : 'flex-1',
		variantClasses.frame,
	]}
	{@attach (element) => on(element, 'keydown', handleKeydown)}
>
	<ScrollArea
		aria-label={`${caption} table`}
		gutter={false}
		class={[
			'@container/resource-table flex flex-col overflow-x-auto overscroll-none scroll-pt-10',
			variant === 'framed' || data.length > 0 ? 'flex-initial' : 'flex-1',
		]}
	>
		<table
			aria-label={caption}
			aria-busy={isLoading}
			class="grid w-full min-w-fit shrink-0 text-sm"
		>
			<ResourceTableHeader
				{tableState}
				{sort}
				{sortConfig}
				refetching={showRefetch}
			/>

			<tbody class="grid">
				{#each tableState.rows as tableRow (tableRow.id)}
					<ResourceTableRow
						{tableState}
						{tableRow}
						{selectedRowId}
						{rowClass}
						{rowDimmed}
						{rowLabel}
						{onRowClick}
						{rowContextMenu}
						{onRowContextMenu}
						{onRowHover}
					/>
				{/each}
			</tbody>
		</table>
		{#if showLoadingState}
			<ResourceTableSkeleton
				gridTemplateColumns={tableState.gridTemplateColumns}
				{columnCount}
			/>
			<span role="status" class="sr-only">
				{loadingMessage ?? `Loading ${caption}`}
			</span>
		{/if}

		{#if hasMore && onLoadMore && data.length > 0}
			<LoadMoreSentinel loading={loadingMore} {onLoadMore} />
		{/if}

		{#if !isLoading && data.length === 0}
			{#if showEmptySnippet && empty}
				{@render empty()}
			{:else}
				<ResourceTableEmptyState
					{emptyMessage}
					{emptyIcon}
					{errorAction}
					{errorMessage}
					{onRetry}
				/>
			{/if}
		{/if}
	</ScrollArea>
	{#if (pagination || footer) && data.length > 0}
		<TableFooter label={footer} {pagination} />
	{/if}
	{@render overlay?.()}
</div>
{#if bulkActions.length > 0}
	<ResourceBulkActionBar
		selectedIds={selection?.selectedRowIds ?? []}
		actions={bulkActions}
		onClear={() => tableState.clearSelection()}
		onPartialFailure={(failedIds) => {
			selection?.onChange(failedIds);
			onPartialFailure?.(failedIds);
		}}
	/>
{/if}
