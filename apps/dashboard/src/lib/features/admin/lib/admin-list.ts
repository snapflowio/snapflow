/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import * as z from 'zod';
import type {
	ResourceSortConfig,
	ResourceSortOption,
} from '#lib/components/resource/resource-options.ts';
import type {
	ResourceSortDirection,
	ResourceSortState,
} from '#lib/components/resource/table/resource-table-sort.ts';
import { searchParamArray } from '#lib/routing/search-params.ts';

export const ADMIN_PAGE_SIZE = 50;
export const ADMIN_SEARCH_DEBOUNCE_MILLISECONDS = 300;

const SORT_DIRECTIONS = ['asc', 'desc'] as const;
const DEFAULT_SORT_DIRECTION = 'desc';

type SortColumns = readonly [string, ...string[]];

interface CursorPage<TItem> {
	items: readonly TItem[];
	nextCursor?: string | null;
}

export const adminCursorPages = {
	initialPageParam: {},
	getNextPageParam: (page: { nextCursor?: string | null }) =>
		page.nextCursor ?? undefined,
};

export function adminPageItems<TItem>(
	data: { pages: readonly CursorPage<TItem>[] } | undefined
): TItem[] {
	return data?.pages.flatMap((page) => page.items) ?? [];
}

export function adminSortFields<const TColumns extends SortColumns>(
	columns: TColumns
) {
	return {
		sort: z.enum(columns).optional().catch(undefined),
		dir: z.enum(SORT_DIRECTIONS).catch(DEFAULT_SORT_DIRECTION),
	};
}

export function adminFilterField<const TValues extends SortColumns>(
	values: TValues
) {
	return searchParamArray(z.enum(values)).catch([]);
}

export const adminSearchField = z.string().catch('');

export function adminSortState(
	sort: string | undefined,
	direction: ResourceSortDirection
): ResourceSortState | undefined {
	return sort ? { column: sort, direction } : undefined;
}

export function adminSortConfig<TColumn extends string>(
	options: readonly (ResourceSortOption & { id: TColumn })[],
	active: ResourceSortState | undefined,
	update: (
		sort: TColumn | undefined,
		direction: ResourceSortDirection | undefined
	) => void
): ResourceSortConfig {
	return {
		options,
		active: active ?? null,
		onSort: (column, direction) => {
			const option = options.find((candidate) => candidate.id === column);
			if (option) update(option.id, direction);
		},
		onClear: () => update(undefined, undefined),
	};
}

export function matchesFilter<TValue>(
	selected: readonly TValue[],
	value: TValue
): boolean {
	return selected.length === 0 || selected.includes(value);
}

export function matchesSearch(
	query: string,
	values: readonly (string | null | undefined)[]
): boolean {
	const normalized = query.trim().toLowerCase();
	if (!normalized) return true;
	return values.some((value) => value?.toLowerCase().includes(normalized));
}

export function copyId(id: string): void {
	void navigator.clipboard.writeText(id);
}
