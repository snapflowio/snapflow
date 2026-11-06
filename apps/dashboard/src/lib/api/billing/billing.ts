/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	getBillingBudgetOptions,
	getBillingBudgetQueryKey,
	getBillingOverviewOptions,
	getBillingOverviewQueryKey,
	updateBillingBudgetMutation,
} from '@snapflow/api-client/svelte-query';
import { mutationOptions, queryOptions } from '@tanstack/svelte-query';

const OVERVIEW_REFRESH_INTERVAL_MILLISECONDS = 15_000;

export function billingOverviewQueryOptions() {
	return queryOptions({
		...getBillingOverviewOptions(),
		refetchInterval: OVERVIEW_REFRESH_INTERVAL_MILLISECONDS,
	});
}

export function billingBudgetQueryOptions() {
	return getBillingBudgetOptions();
}

export function updateBillingBudgetMutationOptions() {
	return mutationOptions({
		...updateBillingBudgetMutation(),
		meta: {
			success: 'Spend limits saved',
			failure: 'Failed to save spend limits',
			invalidates: [getBillingBudgetQueryKey(), getBillingOverviewQueryKey()],
		},
	});
}
