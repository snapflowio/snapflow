/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	createSecret,
	createSecretVersion,
	deleteSecret,
	listSecrets,
	type SecretDto,
	type UpdateSecretDto,
	updateSecret,
} from '@snapflow/api-client';
import {
	getSecretOptions,
	getSecretQueryKey,
	listSecretsQueryKey,
} from '@snapflow/api-client/svelte-query';
import { mutationOptions } from '@tanstack/svelte-query';
import {
	idempotencyHeaders,
	ifMatchHeaders,
} from '#lib/api/client/api-client.ts';
import { allPagesOptions } from '#lib/api/client/cursor-pagination.ts';

export interface SecretDraft {
	description: string;
	name: string;
	value: string;
}

export interface SecretRotation {
	secret: SecretDto;
	value: string;
}

function secretPath(secretId: string) {
	return { path: { secretId } };
}

export function secretQueryOptions(secretId: string) {
	return getSecretOptions(secretPath(secretId));
}

export function updateSecretMutationOptions(secretId: string) {
	return mutationOptions({
		mutationFn: (body: UpdateSecretDto) =>
			updateSecret({ ...secretPath(secretId), body }),
		meta: {
			invalidates: [
				listSecretsQueryKey(),
				getSecretQueryKey(secretPath(secretId)),
			],
			success: 'Secret updated',
			failure: 'Failed to update secret',
		},
	});
}

export function allSecretsQueryOptions() {
	return allPagesOptions(
		listSecretsQueryKey(),
		async (cursor, signal) =>
			(await listSecrets({ query: { cursor }, signal })).data
	);
}

export function createSecretMutationOptions() {
	return mutationOptions({
		mutationFn: ({ description, name, value }: SecretDraft) =>
			createSecret({
				body: {
					name: name.trim(),
					description: description.trim() || undefined,
					value,
				},
				headers: idempotencyHeaders(),
			}),
		meta: {
			invalidates: [listSecretsQueryKey()],
			success: 'Secret created',
			failure: 'Failed to create secret',
		},
	});
}

export function rotateSecretMutationOptions() {
	return mutationOptions({
		mutationFn: ({ secret, value }: SecretRotation) =>
			createSecretVersion({
				path: { secretId: secret.id },
				body: { value },
				headers: idempotencyHeaders(),
			}),
		meta: {
			invalidates: [listSecretsQueryKey()],
			success: 'Secret rotated',
			failure: 'Failed to rotate secret',
		},
	});
}

export function deleteSecretMutationOptions() {
	return mutationOptions({
		mutationFn: (secret: SecretDto) =>
			deleteSecret({
				path: { secretId: secret.id },
				headers: ifMatchHeaders(secret.resourceVersion),
			}),
		meta: {
			invalidates: [listSecretsQueryKey()],
			success: 'Secret deleted',
			failure: 'Failed to delete secret',
		},
	});
}
