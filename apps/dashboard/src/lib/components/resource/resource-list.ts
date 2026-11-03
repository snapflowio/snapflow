/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import * as z from 'zod';
import type { ResourceSortConfig } from '#lib/components/resource/resource-options.ts';
import {
	compareValues,
	type ResourceSortDirection,
	type ResourceSortState,
} from '#lib/components/resource/table/resource-table-sort.ts';

export interface ResourceListSortOption<TColumn extends string> {
	id: TColumn;
	label: string;
}

export type ResourceListSortAccessors<TRow, TColumn extends string> = Readonly<
	Record<TColumn, (row: TRow) => unknown>
>;

export const sortDirectionSchema = z
	.enum(['asc', 'desc'])
	.optional()
	.catch(undefined);

export function sortColumnSchema<
	const TColumns extends readonly [string, ...string[]],
>(columns: TColumns) {
	return z.enum(columns).optional().catch(undefined);
}

export function activeSort(
	column: string | undefined,
	direction: ResourceSortDirection | undefined
): ResourceSortState | null {
	return column ? { column, direction: direction ?? 'desc' } : null;
}

export function sortRows<TRow, TColumn extends string>(
	rows: readonly TRow[],
	sort: ResourceSortState | null,
	accessors: ResourceListSortAccessors<TRow, TColumn>
): readonly TRow[] {
	const accessor = sort
		? Object.entries<(row: TRow) => unknown>(accessors).find(
				([column]) => column === sort.column
			)?.[1]
		: undefined;
	if (!(sort && accessor)) return rows;
	const factor = sort.direction === 'asc' ? 1 : -1;
	return [...rows].sort(
		(left, right) => factor * compareValues(accessor(left), accessor(right))
	);
}

export function resourceListSortConfig<TColumn extends string>(
	options: readonly ResourceListSortOption<TColumn>[],
	active: ResourceSortState | null,
	update: (
		column: TColumn | undefined,
		direction: ResourceSortDirection | undefined
	) => void
): ResourceSortConfig {
	return {
		options,
		active,
		onSort: (column, direction) => {
			const option = options.find((candidate) => candidate.id === column);
			if (option) update(option.id, direction);
		},
		onClear: () => update(undefined, undefined),
	};
}
