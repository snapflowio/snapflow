/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type CreateApiKeyDto, createApiKey } from '@snapflow/api-client';
import { mutationOptions, queryOptions } from '@tanstack/svelte-query';
import { authClient } from '#lib/api/auth/client.ts';
import { unwrapAuthResult } from '#lib/api/auth/result.ts';
import { organizationQueryKeys } from '#lib/api/organizations/query-keys.ts';

async function listApiKeys(organizationId: string) {
	return (
		unwrapAuthResult(
			await authClient.apiKey.list({ query: { organizationId } })
		)?.apiKeys ?? []
	);
}

export type ApiKeyListItem = Awaited<ReturnType<typeof listApiKeys>>[number];

export interface ApiKeyChange {
	apiKey: ApiKeyListItem;
	enabled?: boolean;
	name?: string;
}

export function apiKeysQueryOptions(organizationId: string) {
	return queryOptions({
		queryKey: organizationQueryKeys.apiKeys(organizationId),
		queryFn: () => listApiKeys(organizationId),
		enabled: Boolean(organizationId),
	});
}

export function createApiKeyMutationOptions(organizationId: string) {
	return mutationOptions({
		mutationFn: async (body: CreateApiKeyDto) =>
			(await createApiKey({ body })).data,
		meta: {
			invalidates: [organizationQueryKeys.apiKeys(organizationId)],
			failure: 'Failed to create API key',
		},
	});
}

export function updateApiKeyMutationOptions(organizationId: string) {
	return mutationOptions({
		mutationFn: async ({ apiKey, enabled, name }: ApiKeyChange) =>
			unwrapAuthResult(
				await authClient.apiKey.update({ keyId: apiKey.id, enabled, name })
			),
		meta: {
			invalidates: [organizationQueryKeys.apiKeys(organizationId)],
			success: 'API key updated',
			failure: 'Failed to update API key',
		},
	});
}

export function deleteApiKeyMutationOptions(organizationId: string) {
	return mutationOptions({
		mutationFn: async (apiKey: ApiKeyListItem) =>
			unwrapAuthResult(await authClient.apiKey.delete({ keyId: apiKey.id })),
		meta: {
			invalidates: [organizationQueryKeys.apiKeys(organizationId)],
			success: 'API key deleted',
			failure: 'Failed to delete API key',
		},
	});
}
