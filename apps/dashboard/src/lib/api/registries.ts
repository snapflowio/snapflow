/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type DockerRegistry,
	deleteRegistry,
	listRegistries,
} from '@snapflow/api-client';
import {
	createRegistryMutation,
	getRegistryOptions,
	listRegistriesQueryKey,
	updateRegistryMutation,
} from '@snapflow/api-client/svelte-query';
import { mutationOptions } from '@tanstack/svelte-query';
import { allPagesOptions } from '#lib/api/client/cursor-pagination.ts';

export function registryQueryOptions(registryId: string) {
	return getRegistryOptions({ path: { id: registryId } });
}

export function allRegistriesQueryOptions() {
	return allPagesOptions(
		listRegistriesQueryKey(),
		async (cursor, signal) =>
			(await listRegistries({ query: { cursor }, signal })).data
	);
}

export function createRegistryMutationOptions() {
	return mutationOptions({
		...createRegistryMutation(),
		meta: {
			invalidates: [listRegistriesQueryKey()],
			success: 'Registry created',
			failure: 'Failed to create registry',
		},
	});
}

export function updateRegistryMutationOptions() {
	return mutationOptions({
		...updateRegistryMutation(),
		meta: {
			invalidates: [listRegistriesQueryKey()],
			success: 'Registry updated',
			failure: 'Failed to update registry',
		},
	});
}

export function deleteRegistryMutationOptions() {
	return mutationOptions({
		mutationFn: async (registry: DockerRegistry) => {
			await deleteRegistry({ path: { id: registry.id } });
			return registry;
		},
		meta: {
			invalidates: [listRegistriesQueryKey()],
			failure: 'Failed to delete registry',
		},
	});
}
