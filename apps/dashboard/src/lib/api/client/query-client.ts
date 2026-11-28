/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MutationCache, QueryClient } from '@tanstack/svelte-query';
import { isTermsAcceptanceRequired } from '#lib/api/account/terms.ts';
import { isAdminMfaRequired } from '#lib/api/admin/mfa.ts';
import { resolveMutationMessage } from '#lib/api/client/mutation-meta.ts';
import { showApiError } from '#lib/api/errors/show-api-error.ts';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';

const QUERY_RETRY_COUNT = 1;
const QUERY_STALE_TIME_MILLISECONDS = 30_000;

export function createQueryClient(): QueryClient {
	const queryClient: QueryClient = new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: QUERY_STALE_TIME_MILLISECONDS,
				refetchOnWindowFocus: true,
				notifyOnChangeProps: 'all',
				retry: (failureCount, error) =>
					!isAdminMfaRequired(error) &&
					!isTermsAcceptanceRequired(error) &&
					failureCount < QUERY_RETRY_COUNT,
			},
		},
		mutationCache: new MutationCache({
			onSuccess: async (data, variables, _result, mutation) => {
				const { invalidates = [], success } = mutation.meta ?? {};
				await Promise.all(
					invalidates.map((queryKey) =>
						queryClient.invalidateQueries({ queryKey })
					)
				);
				const message = resolveMutationMessage(success, data, variables);
				if (message) toast.success(message);
			},
			onError: (error, variables, _result, mutation) => {
				if (isTermsAcceptanceRequired(error)) return;
				const message = resolveMutationMessage(
					mutation.meta?.failure,
					error,
					variables
				);
				if (message) showApiError(error, message);
			},
		}),
	});
	return queryClient;
}
