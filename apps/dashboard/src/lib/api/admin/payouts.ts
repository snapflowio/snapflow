/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type ListAdminPayoutsData,
	retryAdminPayout,
} from '@snapflow/api-client';
import {
	listAdminPayoutsInfiniteOptions,
	listAdminPayoutsQueryKey,
} from '@snapflow/api-client/svelte-query';
import { mutationOptions } from '@tanstack/svelte-query';

export function adminPayoutsInfiniteQueryOptions(
	query: ListAdminPayoutsData['query']
) {
	return listAdminPayoutsInfiniteOptions({ query });
}

export function retryAdminPayoutMutationOptions() {
	return mutationOptions({
		mutationFn: (payoutId: string) => retryAdminPayout({ path: { payoutId } }),
		meta: {
			success: 'Payout retry requested',
			failure: 'Failed to retry the payout',
			invalidates: [listAdminPayoutsQueryKey()],
		},
	});
}
