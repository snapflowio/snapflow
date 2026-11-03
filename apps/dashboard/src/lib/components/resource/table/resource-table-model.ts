/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type Column,
	type ColumnDef,
	type ColumnHelper,
	columnVisibilityFeature,
	createColumnHelper,
	createSortedRowModel,
	type Row,
	type RowData,
	type RowSelectionState,
	rowSelectionFeature,
	rowSortingFeature,
	type SortFn,
	type SortingState,
	type SvelteTable,
	tableFeatures,
} from '@tanstack/svelte-table';
import type {
	ResourceColumnLayout,
	ResourceColumnMeta,
} from './resource-table.ts';
import {
	compareValues,
	type ResourceSortState,
} from './resource-table-sort.ts';

export const resourceTableFeatures = tableFeatures({
	rowSortingFeature,
	rowSelectionFeature,
	columnVisibilityFeature,
	sortedRowModel: createSortedRowModel(),
	columnMeta: {} as ResourceColumnMeta,
});

export type ResourceTableFeatures = typeof resourceTableFeatures;

export type ResourceColumnDefs<TData extends RowData> =
	// biome-ignore lint/suspicious/noExplicitAny: TanStack column helpers type heterogeneous column values as any
	readonly ColumnDef<ResourceTableFeatures, TData, any>[];

export type ResourceTableInstance<TData extends RowData> = SvelteTable<
	ResourceTableFeatures,
	TData
>;

export type ResourceTableModelRow<TData extends RowData> = Row<
	ResourceTableFeatures,
	TData
>;

export interface ResourceTableSelection<TData> {
	selectedRowIds: readonly string[];
	onChange: (selectedRowIds: string[]) => void;
	isRowSelectable?: (row: TData) => boolean;
}

export function resourceColumnHelper<TData extends RowData>(): ColumnHelper<
	ResourceTableFeatures,
	TData
> {
	return createColumnHelper<ResourceTableFeatures, TData>();
}

export function resourceSortFn<TData extends RowData>(): SortFn<
	ResourceTableFeatures,
	TData
> {
	return (left, right, columnId) =>
		compareValues(left.getValue(columnId), right.getValue(columnId));
}

export function resourceColumnLayout<TData extends RowData>(
	column: Column<ResourceTableFeatures, TData>
): ResourceColumnLayout {
	return { id: column.id, ...column.columnDef.meta };
}

function resourceColumnDefId<TData extends RowData>(
	def: ResourceColumnDefs<TData>[number]
): string {
	if (def.id) return def.id;
	if ('accessorKey' in def && def.accessorKey !== undefined) {
		return String(def.accessorKey).replaceAll('.', '_');
	}
	return typeof def.header === 'string' ? def.header : '';
}

export function resourceColumnDefLayout<TData extends RowData>(
	def: ResourceColumnDefs<TData>[number]
): ResourceColumnLayout {
	return { id: resourceColumnDefId(def), ...def.meta };
}

export function resourceSortingState(
	sort: ResourceSortState | undefined
): SortingState {
	return sort ? [{ id: sort.column, desc: sort.direction === 'desc' }] : [];
}

export function resourceRowSelectionState(
	selectedRowIds: readonly string[]
): RowSelectionState {
	return Object.fromEntries(
		selectedRowIds.map((rowId) => [rowId, true] as const)
	);
}

export function selectedRowIds(selection: RowSelectionState): string[] {
	return Object.entries(selection)
		.filter(([, selected]) => selected)
		.map(([rowId]) => rowId);
}

export function resourceSelectAllState<TData extends RowData>(
	table: ResourceTableInstance<TData>
): boolean | 'indeterminate' {
	if (table.getIsAllRowsSelected()) return true;
	return table.getIsSomeRowsSelected() ? 'indeterminate' : false;
}
