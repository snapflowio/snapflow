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

const PASSKEYS_QUERY_KEY = ['auth', 'passkeys'] as const;

export function passkeysQueryOptions() {
	return queryOptions({
		queryKey: PASSKEYS_QUERY_KEY,
		queryFn: async () => {
			try {
				return unwrapAuthResult(await authClient.passkey.listUserPasskeys());
			} catch (error) {
				showApiError(error, 'Failed to load passkeys');
				throw error;
			}
		},
		retry: false,
	});
}

export function addPasskeyMutationOptions() {
	return mutationOptions({
		mutationFn: async (name: string | undefined) =>
			unwrapAuthResult(await authClient.passkey.addPasskey({ name })),
		meta: {
			invalidates: [PASSKEYS_QUERY_KEY],
			success: 'Passkey added',
			failure: 'Failed to add passkey',
		},
	});
}

export function deletePasskeyMutationOptions() {
	return mutationOptions({
		mutationFn: async (id: string) =>
			unwrapAuthResult(await authClient.passkey.deletePasskey({ id })),
		meta: {
			invalidates: [PASSKEYS_QUERY_KEY],
			success: 'Passkey removed',
			failure: 'Failed to remove passkey',
		},
	});
}
