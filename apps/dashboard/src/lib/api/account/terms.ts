/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiErrorCode, acceptTerms } from '@snapflow/api-client';
import {
	getAuthenticatedUserOptions,
	getAuthenticatedUserQueryKey,
} from '@snapflow/api-client/svelte-query';
import { mutationOptions } from '@tanstack/svelte-query';
import { hasErrorCode } from '#lib/api/errors/api-error-details.ts';
import { invalidateAll } from '$app/navigation';

export function authenticatedUserQueryOptions() {
	return getAuthenticatedUserOptions();
}

export function acceptTermsMutationOptions() {
	return mutationOptions({
		mutationFn: async (version: string) =>
			(await acceptTerms({ body: { version } })).data,
		onSuccess: async (user, _version, _result, context) => {
			context.client.setQueryData(getAuthenticatedUserQueryKey(), user);
			await Promise.all([context.client.invalidateQueries(), invalidateAll()]);
		},
		meta: { failure: 'Failed to record your acceptance' },
	});
}

export function isTermsAcceptanceRequired(error: unknown): boolean {
	return hasErrorCode(error, ApiErrorCode.TermsAcceptanceRequired);
}
