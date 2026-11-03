/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { mutationOptions, queryOptions } from '@tanstack/svelte-query';
import { authClient } from '#lib/api/auth/client.ts';
import { unwrapAuthResult } from '#lib/api/auth/result.ts';
import { showApiError } from '#lib/api/errors/show-api-error.ts';

const SESSIONS_QUERY_KEY = ['auth', 'sessions'] as const;

export function sessionsQueryOptions() {
	return queryOptions({
		queryKey: SESSIONS_QUERY_KEY,
		queryFn: async () => {
			try {
				return unwrapAuthResult(await authClient.listSessions());
			} catch (error) {
				showApiError(error, 'Failed to load active sessions');
				throw error;
			}
		},
		retry: false,
	});
}

export function revokeSessionMutationOptions() {
	return mutationOptions({
		mutationFn: async (token: string) =>
			unwrapAuthResult(await authClient.revokeSession({ token })),
		meta: {
			invalidates: [SESSIONS_QUERY_KEY],
			success: 'Session revoked',
			failure: 'Failed to revoke session',
		},
	});
}

export function revokeOtherSessionsMutationOptions() {
	return mutationOptions({
		mutationFn: async () =>
			unwrapAuthResult(await authClient.revokeOtherSessions()),
		meta: {
			invalidates: [SESSIONS_QUERY_KEY],
			success: 'Other sessions revoked',
			failure: 'Failed to revoke other sessions',
		},
	});
}
