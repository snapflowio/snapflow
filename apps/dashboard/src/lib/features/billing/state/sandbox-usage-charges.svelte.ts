/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	createInfiniteQuery,
	createQuery,
	keepPreviousData,
} from '@tanstack/svelte-query';
import {
	sandboxUsageSummaryQueryOptions,
	usageChargesInfiniteQueryOptions,
} from '#lib/api/billing/usage.ts';
import Credit from '#lib/components/icons/credit.svelte';
import type { ResourceCrumb } from '#lib/components/resource/resource-breadcrumbs.svelte';
import { sandboxUsageTitle } from '#lib/features/billing/lib/billing-usage.ts';
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
import { OpenRowParam } from '#lib/routing/open-row-param.svelte.ts';
import { Path } from '#lib/routing/paths.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
import { resolve } from '$app/paths';
import { page } from '$app/state';

const CHARGE_PARAM = 'charge';

export class SandboxUsageCharges {
	readonly #sandboxId: () => string;
	readonly #search = new SearchParams(usagePeriodSearchSchema);
	readonly #range = $derived(usageWindow(this.#search.current));

	readonly summaryQuery;
	readonly chargesQuery;
	readonly selection = $derived(this.#search.current);
	readonly charges = $derived.by(() => cursorPageItems(this.chargesQuery.data));
	readonly panel = new OpenRowParam(
		() => this.charges,
		(line) => line.id,
		{ param: CHARGE_PARAM, closeWithBack: true }
	);
	readonly title = $derived.by(() =>
		this.summaryQuery.data
			? sandboxUsageTitle(this.summaryQuery.data)
			: this.#sandboxId()
	);
	readonly breadcrumbs = $derived.by((): ResourceCrumb[] => [
		{ label: 'Billing', href: resolve(Path.BILLING), icon: Credit },
		{
			label: 'Usage',
			href: `${resolve(Path.BILLING_USAGE)}${page.url.search}`,
		},
		{ label: this.title },
	]);

	constructor(sandboxId: () => string) {
		this.#sandboxId = sandboxId;
		this.summaryQuery = createQuery(() =>
			sandboxUsageSummaryQueryOptions(sandboxId())
		);
		this.chargesQuery = createInfiniteQuery(() => ({
			...usageChargesInfiniteQueryOptions({
				limit: CURSOR_PAGE_SIZE,
				sandboxId: sandboxId(),
				...this.#range,
			}),
			initialPageParam: {},
			getNextPageParam: nextCursorPage,
			placeholderData: keepPreviousData,
		}));
	}

	select = (selection: UsagePeriodSelection): void => {
		void this.#search.update(selection);
	};
}
