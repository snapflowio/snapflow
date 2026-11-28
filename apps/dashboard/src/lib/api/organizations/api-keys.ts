/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type CreateApiKeyDto, createApiKey } from '@snapflow/api-client';
import {
	getApiKeyBudgetOptions,
	getApiKeyBudgetQueryKey,
	updateApiKeyBudgetMutation,
} from '@snapflow/api-client/svelte-query';
import { mutationOptions, queryOptions } from '@tanstack/svelte-query';
import { authClient } from '#lib/api/auth/client.ts';
import { unwrapAuthResult } from '#lib/api/auth/result.ts';
import { organizationQueryKeys } from '#lib/api/organizations/query-keys.ts';

const API_KEY_CONFIG_ID = 'default';

async function listApiKeys(organizationId: string) {
	const apiKeys =
		unwrapAuthResult(
			await authClient.apiKey.list({ query: { organizationId } })
		)?.apiKeys ?? [];
	return apiKeys.filter((apiKey) => apiKey.configId === API_KEY_CONFIG_ID);
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

export function apiKeyBudgetQueryKey(apiKeyId: string) {
	return getApiKeyBudgetQueryKey({ path: { apiKeyId } });
}

export function apiKeyBudgetQueryOptions(apiKeyId: string) {
	return getApiKeyBudgetOptions({ path: { apiKeyId } });
}

export function updateApiKeyBudgetMutationOptions() {
	return mutationOptions({
		...updateApiKeyBudgetMutation(),
		meta: {
			success: 'API key budget saved',
			failure: 'Failed to save the API key budget',
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
