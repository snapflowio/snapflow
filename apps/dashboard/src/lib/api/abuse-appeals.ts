/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type AppealAbuseDecision,
	appealAbuseDecision,
} from '@snapflow/api-client';
import {
	getAbuseAppealOptions,
	getAbuseAppealQueryKey,
} from '@snapflow/api-client/svelte-query';
import { mutationOptions, queryOptions } from '@tanstack/svelte-query';

export function abuseAppealQueryOptions(caseId: string) {
	return queryOptions({
		...getAbuseAppealOptions({ path: { caseId } }),
		retry: false,
	});
}

export function appealAbuseDecisionMutationOptions(caseId: string) {
	return mutationOptions({
		mutationFn: async (body: AppealAbuseDecision) => {
			await appealAbuseDecision({ path: { caseId }, body });
		},
		meta: {
			invalidates: [getAbuseAppealQueryKey({ path: { caseId } })],
			success: 'Appeal sent',
			failure: 'Failed to send the appeal',
		},
	});
}
