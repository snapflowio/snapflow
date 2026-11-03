/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type CreatePayoutAccount,
	createPayoutAccount,
	createPayoutAccountSession,
	type ListPayoutsData,
} from '@snapflow/api-client';
import {
	getHostEarningsOptions,
	getPayoutAccountOptions,
	getPayoutAccountQueryKey,
	listPayoutsInfiniteOptions,
} from '@snapflow/api-client/svelte-query';
import { mutationOptions, queryOptions } from '@tanstack/svelte-query';
import { apiErrorCode } from '#lib/api/errors/api-error-details.ts';

const PAYOUT_ACCOUNT_MISSING_CODE = 'payout_account_missing';

export function payoutAccountQueryOptions() {
	return queryOptions({ ...getPayoutAccountOptions(), retry: false });
}

export function payoutsInfiniteQueryOptions(query: ListPayoutsData['query']) {
	return listPayoutsInfiniteOptions({ query });
}

export function hostEarningsQueryOptions() {
	return getHostEarningsOptions();
}

export async function fetchPayoutAccountSessionSecret(): Promise<string> {
	return (await createPayoutAccountSession()).data.clientSecret;
}

export function isPayoutAccountMissing(error: unknown): boolean {
	return apiErrorCode(error) === PAYOUT_ACCOUNT_MISSING_CODE;
}

export function createPayoutAccountMutationOptions() {
	return mutationOptions({
		mutationFn: (body: CreatePayoutAccount) => createPayoutAccount({ body }),
		meta: {
			failure: 'Failed to create the payout account',
			invalidates: [getPayoutAccountQueryKey()],
		},
	});
}
