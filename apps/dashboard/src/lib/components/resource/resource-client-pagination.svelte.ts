/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { ResourcePaginationConfig } from '#lib/components/resource/resource-pagination.ts';

const CLIENT_PAGE_SIZE = 50;
const FIRST_PAGE = 1;

export class ClientPagination<TRow> {
	readonly #rows: () => readonly TRow[];
	readonly #resetKey: () => unknown;

	page: number = $derived.by(() => {
		void this.#resetKey();
		return FIRST_PAGE;
	});
	readonly totalPages = $derived(
		Math.max(FIRST_PAGE, Math.ceil(this.#all.length / CLIENT_PAGE_SIZE))
	);
	readonly #current = $derived(Math.min(this.page, this.totalPages));
	readonly rows: readonly TRow[] = $derived(
		this.#all.slice(
			(this.#current - FIRST_PAGE) * CLIENT_PAGE_SIZE,
			this.#current * CLIENT_PAGE_SIZE
		)
	);
	readonly config: ResourcePaginationConfig = $derived({
		page: this.#current,
		pageSize: CLIENT_PAGE_SIZE,
		totalItems: this.#all.length,
		totalPages: this.totalPages,
		onPageChange: (page: number) => {
			this.page = page;
		},
	});

	constructor(rows: () => readonly TRow[], resetKey: () => unknown) {
		this.#rows = rows;
		this.#resetKey = resetKey;
	}

	get #all(): readonly TRow[] {
		return this.#rows();
	}
}
