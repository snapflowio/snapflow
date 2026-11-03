/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const CURSOR_PAGE_SIZE = 50;

interface CursorPage<TItem> {
	items: readonly TItem[];
	nextCursor?: string | null;
}

export function nextCursorPage(
	page: Pick<CursorPage<unknown>, 'nextCursor'>
): string | undefined {
	return page.nextCursor ?? undefined;
}

export function cursorPageItems<TItem>(
	data: { pages: readonly CursorPage<TItem>[] } | undefined
): TItem[] {
	return data?.pages.flatMap((page) => page.items) ?? [];
}
