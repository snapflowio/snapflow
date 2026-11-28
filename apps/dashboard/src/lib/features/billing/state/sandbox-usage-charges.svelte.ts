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
import { sandboxUsageTitle } from '#lib/features/billing/lib/billing-usage.ts';
import {
	CURSOR_PAGE_SIZE,
	cursorPageItems,
	nextCursorPage,
} from '#lib/features/billing/lib/infinite-cursor.ts';
import type { UsageWindow } from '#lib/features/billing/lib/usage-period.ts';
import { OpenRowParam } from '#lib/routing/open-row-param.svelte.ts';

const CHARGE_PARAM = 'charge';

export class SandboxUsageCharges {
	readonly #sandboxId: () => string;

	readonly summaryQuery;
	readonly chargesQuery;
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

	constructor(sandboxId: () => string, range: () => UsageWindow) {
		this.#sandboxId = sandboxId;
		this.summaryQuery = createQuery(() =>
			sandboxUsageSummaryQueryOptions(sandboxId())
		);
		this.chargesQuery = createInfiniteQuery(() => ({
			...usageChargesInfiniteQueryOptions({
				limit: CURSOR_PAGE_SIZE,
				sandboxId: sandboxId(),
				...range(),
			}),
			initialPageParam: {},
			getNextPageParam: nextCursorPage,
			placeholderData: keepPreviousData,
		}));
	}
}
