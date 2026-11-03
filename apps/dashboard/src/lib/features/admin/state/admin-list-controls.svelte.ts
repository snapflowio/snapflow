/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	ResourceFilterTag,
	ResourceSortConfig,
	ResourceSortOption,
} from '#lib/components/resource/resource-options.ts';
import type {
	ResourceSortDirection,
	ResourceSortState,
} from '#lib/components/resource/table/resource-table-sort.ts';
import {
	type AdminFilterField,
	adminFilterTags,
} from '#lib/features/admin/lib/admin-filters.ts';
import {
	adminSortConfig,
	adminSortState,
} from '#lib/features/admin/lib/admin-list.ts';
import type { SearchParamText } from '#lib/routing/search-params.svelte.ts';

const SEARCH_KEY = 'q';

interface AdminListValues {
	readonly q: string;
	readonly sort?: string | undefined;
	readonly dir: ResourceSortDirection;
}

export interface AdminListParams {
	readonly current: AdminListValues;
	update(patch: Readonly<Record<string, unknown>>): Promise<void>;
	text(key: typeof SEARCH_KEY, options?: { wait?: number }): SearchParamText;
}

export interface AdminListControlsOptions {
	readonly sortOptions: readonly ResourceSortOption[];
	readonly filterKeys: readonly string[];
	readonly filterFields?: () => readonly AdminFilterField[];
	readonly searchWait?: number;
}

function clearedKeys(keys: readonly string[]): Record<string, undefined> {
	return Object.fromEntries(keys.map((key) => [key, undefined]));
}

export class AdminListControls {
	readonly #params: AdminListParams;
	readonly #options: AdminListControlsOptions;

	readonly search: SearchParamText;
	readonly query: string = $derived.by(() => this.#params.current.q);
	readonly sort: ResourceSortState | undefined = $derived.by(() =>
		adminSortState(this.#params.current.sort, this.#params.current.dir)
	);
	readonly filterFields: readonly AdminFilterField[] = $derived.by(
		() => this.#options.filterFields?.() ?? []
	);
	readonly filterTags: ResourceFilterTag[] = $derived.by(() =>
		adminFilterTags(this.filterFields)
	);
	readonly sortConfig: ResourceSortConfig = $derived.by(() =>
		adminSortConfig(this.#options.sortOptions, this.sort, (sort, dir) => {
			void this.#params.update({ sort, dir });
		})
	);

	constructor(params: AdminListParams, options: AdminListControlsOptions) {
		this.#params = params;
		this.#options = options;
		this.search =
			options.searchWait === undefined
				? params.text(SEARCH_KEY)
				: params.text(SEARCH_KEY, { wait: options.searchWait });
	}

	clearFilters = (): void => {
		void this.#params.update(clearedKeys(this.#options.filterKeys));
	};

	clearSearchAndFilters = (): void => {
		this.search.value = '';
		void this.#params.update(
			clearedKeys([SEARCH_KEY, ...this.#options.filterKeys])
		);
	};
}
