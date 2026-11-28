/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type HostPayout,
	type ListHostPayoutsData,
	listHostPayouts,
} from '@snapflow/api-client';
import { listHostPayoutsInfiniteOptions } from '@snapflow/api-client/svelte-query';
import { collectCursorPages } from '#lib/api/client/cursor-pagination.ts';

export const HOST_PAYOUTS_PAGE_SIZE = 50;

type HostPayoutsQuery = NonNullable<ListHostPayoutsData['query']>;

export type HostPayoutsFilter = Pick<
	HostPayoutsQuery,
	'machineId' | 'from' | 'to'
>;

export function hostPayoutsInfiniteQueryOptions(filter: HostPayoutsFilter) {
	return listHostPayoutsInfiniteOptions({
		query: { ...filter, limit: HOST_PAYOUTS_PAGE_SIZE },
	});
}

export function fetchAllHostPayouts(
	filter: HostPayoutsFilter
): Promise<HostPayout[]> {
	return collectCursorPages(
		async (cursor) =>
			(
				await listHostPayouts({
					query: { ...filter, cursor, limit: HOST_PAYOUTS_PAGE_SIZE },
				})
			).data
	);
}
