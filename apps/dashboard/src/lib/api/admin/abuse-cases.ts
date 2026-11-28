/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type AbuseCase,
	adminListAbuseCases,
	adminResolveAbuseCase,
} from '@snapflow/api-client';
import { adminListAbuseCasesQueryKey } from '@snapflow/api-client/svelte-query';
import { mutationOptions } from '@tanstack/svelte-query';
import { allPagesOptions } from '#lib/api/client/cursor-pagination.ts';

export function adminAllAbuseCasesQueryOptions() {
	return allPagesOptions(
		adminListAbuseCasesQueryKey(),
		async (cursor, signal) =>
			(await adminListAbuseCases({ query: { cursor }, signal })).data
	);
}

export function resolveAbuseCaseMutationOptions() {
	return mutationOptions({
		mutationFn: (abuseCase: AbuseCase) =>
			adminResolveAbuseCase({ path: { caseId: abuseCase.id } }),
		meta: {
			success: 'Abuse case resolved',
			failure: 'Failed to resolve the abuse case',
			invalidates: [adminListAbuseCasesQueryKey()],
		},
	});
}
