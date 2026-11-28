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
	type BillingUsageSelection,
	billingUsageSearchSchema,
	billingUsageWindow,
	CALENDAR_MONTH_PERIOD,
	formatMonthKey,
	selectedMonth,
	shiftMonth,
	USAGE_RECORD_PARAM,
} from '#lib/features/billing/lib/billing-usage-period.ts';
import {
	CURSOR_PAGE_SIZE,
	cursorPageItems,
	nextCursorPage,
} from '#lib/features/billing/lib/infinite-cursor.ts';
import { OpenRowParam } from '#lib/routing/open-row-param.svelte.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';

export class SandboxUsageList {
	readonly #params = new SearchParams(billingUsageSearchSchema);

	readonly selection = $derived(this.#params.current);
	readonly range = $derived(billingUsageWindow(this.#params.current));
	readonly calendarMonth = $derived(
		this.selection.period === CALENDAR_MONTH_PERIOD
	);
	readonly month = $derived(selectedMonth(this.selection));
	readonly monthLabel = $derived(formatMonthKey(this.month));
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
	readonly usage = $derived(cursorPageItems(this.query.data));
	readonly totalMicroUsd = $derived(
		this.query.data?.pages[0]?.totalMicroUsd ?? '0'
	);
	readonly updatedAt = $derived(
		this.query.dataUpdatedAt > 0 ? new Date(this.query.dataUpdatedAt) : null
	);
	readonly panel = new OpenRowParam(
		() => this.usage,
		(row) => row.sandboxId,
		{ param: USAGE_RECORD_PARAM, closeWithBack: true }
	);

	select = (selection: Omit<BillingUsageSelection, 'month'>): void => {
		void this.#params.update(selection);
	};

	stepMonth = (offset: number): void => {
		void this.#params.update({
			period: CALENDAR_MONTH_PERIOD,
			month: shiftMonth(this.month, offset),
			from: '',
			to: '',
		});
	};
}
