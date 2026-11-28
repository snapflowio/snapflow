/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type AdminListQuotaIncreaseRequestsData,
	adminApproveQuotaIncreaseRequest,
	adminDenyQuotaIncreaseRequest,
} from '@snapflow/api-client';
import {
	adminListQuotaIncreaseRequestsInfiniteOptions,
	adminListQuotaIncreaseRequestsQueryKey,
} from '@snapflow/api-client/svelte-query';
import { mutationOptions } from '@tanstack/svelte-query';

export type QuotaIncreaseDecision =
	| { requestId: string; approve: true; note: string }
	| { requestId: string; approve: false; reason: string };

export function quotaIncreaseRequestsInfiniteQueryOptions(
	query: AdminListQuotaIncreaseRequestsData['query']
) {
	return adminListQuotaIncreaseRequestsInfiniteOptions({ query });
}

export function decideQuotaIncreaseRequestMutationOptions() {
	return mutationOptions({
		mutationFn: (decision: QuotaIncreaseDecision) => {
			const path = { requestId: decision.requestId };
			return decision.approve
				? adminApproveQuotaIncreaseRequest({
						path,
						body: decision.note ? { note: decision.note } : {},
					})
				: adminDenyQuotaIncreaseRequest({
						path,
						body: { reason: decision.reason },
					});
		},
		meta: {
			success: 'Request reviewed',
			failure: 'Failed to review the request',
			invalidates: [adminListQuotaIncreaseRequestsQueryKey()],
		},
	});
}
