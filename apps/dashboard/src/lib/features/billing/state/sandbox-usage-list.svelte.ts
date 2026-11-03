/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createInfiniteQuery, keepPreviousData } from '@tanstack/svelte-query';
import { sandboxUsageInfiniteQueryOptions } from '#lib/api/billing/usage.ts';
import { HIGHEST_COST_FIRST } from '#lib/features/billing/lib/billing-usage.ts';
import {
	CURSOR_PAGE_SIZE,
	cursorPageItems,
	nextCursorPage,
} from '#lib/features/billing/lib/infinite-cursor.ts';
import {
	type UsagePeriodSelection,
	usagePeriodSearchSchema,
	usageWindow,
} from '#lib/features/billing/lib/usage-period.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
import { formatUsd } from '#lib/utils/usd.ts';
import { resolve } from '$app/paths';
import { page } from '$app/state';

export class SandboxUsageList {
	readonly #params = new SearchParams(usagePeriodSearchSchema);

	readonly range = $derived(usageWindow(this.#params.current));
	readonly query = createInfiniteQuery(() => ({
		...sandboxUsageInfiniteQueryOptions({
			limit: CURSOR_PAGE_SIZE,
			...HIGHEST_COST_FIRST,
			...this.range,
		}),
		initialPageParam: {},
		getNextPageParam: nextCursorPage,
		placeholderData: keepPreviousData,
	}));
	readonly selection = $derived(this.#params.current);
	readonly usage = $derived(cursorPageItems(this.query.data));
	readonly totalMicroUsd = $derived(
		this.query.data?.pages[0]?.totalMicroUsd ?? '0'
	);
	readonly totalLabel = $derived(
		this.query.isLoading
			? 'Loading...'
			: this.query.isError && !this.query.data
				? 'Unavailable'
				: this.query.isPlaceholderData
					? 'Updating...'
					: formatUsd(this.totalMicroUsd)
	);

	select = (selection: UsagePeriodSelection): void => {
		void this.#params.update(selection);
	};

	sandboxHref = (sandboxId: string): string =>
		`${resolve('/(app)/(dashboard)/billing/usage/[sandboxId]', { sandboxId })}${page.url.search}`;
}
