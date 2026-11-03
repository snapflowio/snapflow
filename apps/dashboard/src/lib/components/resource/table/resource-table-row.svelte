<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const INTERACTIVE_ROW_TARGETS =
	'button, input, a, [role="button"], [role="checkbox"], [role="menuitem"], [role="menu"]';
const ROW_ACTIVATION_KEYS: ReadonlySet<string> = new Set(['Enter', ' ']);
</script>

<script lang="ts" generics="TData extends RowData">
// biome-ignore lint/correctness/noUnusedImports: used by the generics attribute, which Biome does not read
import type { RowData } from '@tanstack/svelte-table';
import type { ClassValue } from 'svelte/elements';
import {
	resourceTableRowClass,
	resourceTableRowIdleClass,
	resourceTableRowSelectedClass,
} from './resource-table.ts';
import ResourceTableCell from './resource-table-cell.svelte';
import type { ResourceTableModelRow } from './resource-table-model.ts';
import type { ResourceTableState } from './resource-table-state.svelte.ts';

interface ResourceTableRowProps {
	tableState: ResourceTableState<TData>;
	tableRow: ResourceTableModelRow<TData>;
	selectedRowId?: string | null;
	rowClass?: (row: TData) => ClassValue;
	rowLabel?: (row: TData) => string;
	onRowClick?: (rowId: string) => void;
	onRowContextMenu?: (event: MouseEvent, rowId: string) => void;
	onRowHover?: (rowId: string) => void;
}

let {
	tableState,
	tableRow,
	selectedRowId,
	rowClass,
	rowLabel,
	onRowClick,
	onRowContextMenu,
	onRowHover,
}: ResourceTableRowProps = $props();

const rowId = $derived(tableRow.id);
const selected = $derived(
	selectedRowId === rowId ||
		tableState.contextMenuRowId === rowId ||
		tableState.isSelected(rowId)
);
const clickable = $derived(
	Boolean(onRowClick) || tableState.selectedIds.length > 0
);

function handleClick(event: MouseEvent) {
	const { target } = event;
	if (target instanceof Element && target.closest(INTERACTIVE_ROW_TARGETS)) {
		return;
	}
	if (tableState.selectionClick(event, rowId)) {
		event.preventDefault();
		return;
	}
	onRowClick?.(rowId);
}

function handleKeydown(
	event: KeyboardEvent & { currentTarget: EventTarget & HTMLTableRowElement }
) {
	if (
		event.target !== event.currentTarget ||
		!ROW_ACTIVATION_KEYS.has(event.key)
	) {
		return;
	}
	event.preventDefault();
	onRowClick?.(rowId);
}

function handleContextMenu(event: MouseEvent) {
	tableState.setContextMenuRow(rowId);
	onRowContextMenu?.(event, rowId);
}
</script>

<tr
	aria-selected={selectedRowId === undefined &&
	tableState.selectedIds.length === 0
		? undefined
		: selected}
	data-resource-row=""
	data-row-id={rowId}
	tabindex={onRowClick ? 0 : undefined}
	class={[
		resourceTableRowClass,
		selected ? resourceTableRowSelectedClass : resourceTableRowIdleClass,
		clickable && 'cursor-pointer',
		rowClass?.(tableRow.original),
	]}
	style:grid-template-columns={tableState.gridTemplateColumns}
	onclick={handleClick}
	oncontextmenu={onRowContextMenu ? handleContextMenu : undefined}
	onkeydown={onRowClick ? handleKeydown : undefined}
	onmouseenter={onRowHover ? () => onRowHover(rowId) : undefined}
>
	{#each tableRow.getVisibleCells() as cell (cell.id)}
		<ResourceTableCell {cell} label={rowLabel?.(tableRow.original) ?? rowId} />
	{/each}
</tr>
