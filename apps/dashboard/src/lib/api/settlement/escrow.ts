/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { ListEscrowEventsData } from '@snapflow/api-client';
import {
	getBillingOverviewQueryKey,
	getEscrowAccountOptions,
	getEscrowAccountQueryKey,
	getVoucherDelegationQueryKey,
	listEscrowEventsInfiniteOptions,
	listEscrowEventsInfiniteQueryKey,
	listEscrowEventsOptions,
	listEscrowEventsQueryKey,
} from '@snapflow/api-client/svelte-query';
import { queryOptions } from '@tanstack/svelte-query';

const ESCROW_REFRESH_INTERVAL_MILLISECONDS = 15_000;

export const ESCROW_QUERY_KEYS = [
	getEscrowAccountQueryKey(),
	getVoucherDelegationQueryKey(),
	getBillingOverviewQueryKey(),
	listEscrowEventsInfiniteQueryKey(),
	listEscrowEventsQueryKey(),
];

export function escrowAccountQueryOptions() {
	return queryOptions({
		...getEscrowAccountOptions(),
		refetchInterval: ESCROW_REFRESH_INTERVAL_MILLISECONDS,
	});
}

export function escrowEventsInfiniteQueryOptions(
	query: ListEscrowEventsData['query']
) {
	return listEscrowEventsInfiniteOptions({ query });
}

export function recentEscrowEventsQueryOptions(
	query: ListEscrowEventsData['query']
) {
	return listEscrowEventsOptions({ query });
}
