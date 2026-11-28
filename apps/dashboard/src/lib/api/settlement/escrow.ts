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
	getAutoTopUpOptions,
	getAutoTopUpQueryKey,
	getBillingOverviewQueryKey,
	getEscrowAccountOptions,
	getEscrowAccountQueryKey,
	getEscrowPendingChangesQueryKey,
	getHostEscrowBalanceOptions,
	getHostEscrowBalanceQueryKey,
	getVoucherDelegationQueryKey,
	listEscrowEventsInfiniteOptions,
	listEscrowEventsInfiniteQueryKey,
	listEscrowEventsOptions,
	listEscrowEventsQueryKey,
	listPaymentChannelsInfiniteQueryKey,
} from '@snapflow/api-client/svelte-query';
import { queryOptions } from '@tanstack/svelte-query';

export const ESCROW_REFRESH_INTERVAL_MILLISECONDS = 15_000;

export const ESCROW_DEPOSIT_MUTATION_KEY = ['escrow', 'deposit'] as const;
export const ESCROW_WITHDRAWAL_REQUEST_MUTATION_KEY = [
	'escrow',
	'request-withdrawal',
] as const;
export const ESCROW_WITHDRAWAL_CANCEL_MUTATION_KEY = [
	'escrow',
	'cancel-withdrawal',
] as const;
export const ESCROW_WITHDRAWAL_COMPLETE_MUTATION_KEY = [
	'escrow',
	'complete-withdrawal',
] as const;

export const ESCROW_QUERY_KEYS = [
	getEscrowAccountQueryKey(),
	getEscrowPendingChangesQueryKey(),
	getHostEscrowBalanceQueryKey(),
	getVoucherDelegationQueryKey(),
	getBillingOverviewQueryKey(),
	listEscrowEventsInfiniteQueryKey(),
	listEscrowEventsQueryKey(),
	listPaymentChannelsInfiniteQueryKey(),
	getAutoTopUpQueryKey(),
];

export function escrowAccountQueryOptions() {
	return queryOptions({
		...getEscrowAccountOptions(),
		refetchInterval: ESCROW_REFRESH_INTERVAL_MILLISECONDS,
	});
}

export function hostEscrowBalanceQueryOptions() {
	return queryOptions({
		...getHostEscrowBalanceOptions(),
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

export function autoTopUpQueryOptions() {
	return queryOptions({
		...getAutoTopUpOptions(),
		refetchInterval: ESCROW_REFRESH_INTERVAL_MILLISECONDS,
	});
}
