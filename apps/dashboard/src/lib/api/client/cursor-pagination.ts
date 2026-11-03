/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { queryOptions } from '@tanstack/svelte-query';

interface CursorPage<T> {
	items: T[];
	nextCursor: string | null;
}

type CursorPageFetcher<T> = (
	cursor: string | undefined,
	signal: AbortSignal
) => Promise<CursorPage<T>>;

const ALL_PAGES_KEY = 'all-pages';

export async function collectCursorPages<T>(
	fetchPage: (cursor?: string) => Promise<CursorPage<T>>
): Promise<T[]> {
	const items: T[] = [];
	const visitedCursors = new Set<string>();
	let cursor: string | undefined;

	do {
		const page = await fetchPage(cursor);
		items.push(...page.items);
		cursor = page.nextCursor ?? undefined;
		if (cursor && visitedCursors.has(cursor)) {
			throw new Error('API returned a repeated pagination cursor');
		}
		if (cursor) visitedCursors.add(cursor);
	} while (cursor);

	return items;
}

export function allPagesOptions<T, TKey extends readonly unknown[]>(
	queryKey: TKey,
	fetchPage: CursorPageFetcher<T>
) {
	return queryOptions({
		queryKey: [...queryKey, ALL_PAGES_KEY] as const,
		queryFn: ({ signal }) =>
			collectCursorPages((cursor) => fetchPage(cursor, signal)),
	});
}
