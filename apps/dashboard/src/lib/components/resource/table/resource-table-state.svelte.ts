/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	createTable,
	functionalUpdate,
	type RowData,
	type RowSelectionState,
	type Updater,
} from '@tanstack/svelte-table';
import { isModKey } from '#lib/utils/keyboard.ts';
import {
	buildGridTemplateColumns,
	compactColumnVisibility,
	type ResourceColumnLayout,
} from './resource-table.ts';
import {
	type ResourceColumnDefs,
	type ResourceTableInstance,
	type ResourceTableModelRow,
	type ResourceTableSelection,
	resourceColumnDefLayout,
	resourceColumnLayout,
	resourceRowSelectionState,
	resourceSelectAllState,
	resourceSortFn,
	resourceSortingState,
	resourceTableFeatures,
	selectedRowIds,
} from './resource-table-model.ts';
import type { ResourceSortState } from './resource-table-sort.ts';

export interface ResourceTableStateOptions<TData extends RowData> {
	columns: ResourceColumnDefs<TData>;
	data: readonly TData[];
	getRowId: (row: TData) => string;
	compact: boolean;
	sort?: ResourceSortState;
	selection?: ResourceTableSelection<TData>;
}

export class ResourceTableState<TData extends RowData> {
	readonly table: ResourceTableInstance<TData>;
	contextMenuRowId = $state<string | null>(null);

	readonly layouts: ResourceColumnLayout[];
	readonly gridTemplateColumns: string;
	readonly actionColumnId: string | undefined;
	readonly #options: () => ResourceTableStateOptions<TData>;
	#anchorRowId: string | null = null;

	constructor(options: () => ResourceTableStateOptions<TData>) {
		this.#options = options;
		const sorting = $derived(resourceSortingState(options().sort));
		const rowSelection = $derived(
			resourceRowSelectionState(options().selection?.selectedRowIds ?? [])
		);
		const columnVisibility = $derived(
			options().compact
				? compactColumnVisibility(
						options().columns.map(resourceColumnDefLayout)
					)
				: {}
		);
		this.table = createTable({
			features: resourceTableFeatures,
			defaultColumn: { sortFn: resourceSortFn<TData>() },
			get columns() {
				return options().columns;
			},
			get data() {
				return options().data;
			},
			get enableSorting() {
				return Boolean(options().sort);
			},
			getRowId: (row) => options().getRowId(row),
			get enableRowSelection() {
				const selection = options().selection;
				if (!selection) return false;
				return (row: ResourceTableModelRow<TData>) =>
					selection.isRowSelectable?.(row.original) ?? true;
			},
			get onRowSelectionChange() {
				const selection = options().selection;
				if (!selection) return undefined;
				return (updater: Updater<RowSelectionState>) => {
					selection.onChange(
						selectedRowIds(functionalUpdate(updater, rowSelection))
					);
				};
			},
			state: {
				get rowSelection() {
					return rowSelection;
				},
				get sorting() {
					return sorting;
				},
				get columnVisibility() {
					return columnVisibility;
				},
			},
		});
		this.layouts = $derived(
			this.table.getVisibleLeafColumns().map(resourceColumnLayout)
		);
		this.gridTemplateColumns = $derived(buildGridTemplateColumns(this.layouts));
		this.actionColumnId = $derived(
			this.layouts.find((layout) => layout.variant === 'actions')?.id
		);
	}

	get rows(): ResourceTableModelRow<TData>[] {
		return this.table.getRowModel().rows;
	}

	get selectAllState(): boolean | 'indeterminate' {
		return resourceSelectAllState(this.table);
	}

	get hasSelectableRows(): boolean {
		return this.rows.some((row) => row.getCanSelect());
	}

	get selectedIds(): readonly string[] {
		return this.#options().selection?.selectedRowIds ?? [];
	}

	isSelected = (rowId: string): boolean => this.selectedIds.includes(rowId);

	#selectableIds(): string[] {
		return this.rows.filter((row) => row.getCanSelect()).map((row) => row.id);
	}

	#rangeIds(fromId: string, toId: string): string[] {
		const ids = this.rows.map((row) => row.id);
		const from = ids.indexOf(fromId);
		const to = ids.indexOf(toId);
		if (from === -1 || to === -1) return [toId];
		const [start, end] = from < to ? [from, to] : [to, from];
		const selectable = new Set(this.#selectableIds());
		return ids.slice(start, end + 1).filter((id) => selectable.has(id));
	}

	selectionClick = (event: MouseEvent, rowId: string): boolean => {
		const selection = this.#options().selection;
		if (!selection) return false;
		const current = selection.selectedRowIds;
		if (!(event.shiftKey || isModKey(event) || current.length > 0)) {
			return false;
		}
		if (!this.table.getRow(rowId).getCanSelect()) return true;
		let next: string[];
		if (event.shiftKey && this.#anchorRowId) {
			next = [
				...new Set([...current, ...this.#rangeIds(this.#anchorRowId, rowId)]),
			];
		} else if (current.includes(rowId)) {
			next = current.filter((id) => id !== rowId);
		} else {
			next = [...current, rowId];
		}
		this.#anchorRowId = rowId;
		selection.onChange(next);
		return true;
	};

	selectAll = (): void => {
		this.#options().selection?.onChange(this.#selectableIds());
	};

	clearSelection = (): void => {
		this.#anchorRowId = null;
		this.#options().selection?.onChange([]);
	};

	setContextMenuRow = (rowId: string): void => {
		this.contextMenuRowId = rowId;
	};

	clearContextMenuRow = (): void => {
		this.contextMenuRowId = null;
	};

	clearContextMenuRowOnEscape = (event: KeyboardEvent): void => {
		if (event.key === 'Escape') this.clearContextMenuRow();
	};
}
