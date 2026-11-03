/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type AdminCreateDockerRegistry,
	type AdminUpdateDockerRegistry,
	adminCreatePlatformRegistry,
	adminDeletePlatformRegistry,
	adminUpdatePlatformRegistry,
	adminUpdateSettings,
	type DockerRegistry,
	type Settings,
	type UpdateSettings,
} from '@snapflow/api-client';
import {
	adminGetSettingsOptions,
	adminGetSettingsQueryKey,
	adminListPlatformRegistriesOptions,
	adminListPlatformRegistriesQueryKey,
	adminSetDrainingPolicyMutation,
	adminSetMaintenanceModeMutation,
} from '@snapflow/api-client/svelte-query';
import { mutationOptions, type QueryClient } from '@tanstack/svelte-query';
import {
	idempotencyHeaders,
	ifMatchHeaders,
} from '#lib/api/client/api-client.ts';
import { appMutationOptions } from '#lib/api/client/mutation-meta.ts';
import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';

const VERSION_CONFLICT_CODE = 'SETTINGS_VERSION_CONFLICT';

interface SettingsChange {
	changes: UpdateSettings;
	settings: Settings;
}

export function isSettingsVersionConflict(error: unknown): boolean {
	return SnapflowError.fromUnknown(error).code === VERSION_CONFLICT_CODE;
}

function storeSettings(queryClient: QueryClient, settings: Settings): void {
	queryClient.setQueryData(adminGetSettingsQueryKey(), settings);
}

export function adminSettingsQueryOptions() {
	return adminGetSettingsOptions();
}

export function reloadAdminSettings(queryClient: QueryClient): Promise<void> {
	return queryClient.invalidateQueries({
		queryKey: adminGetSettingsQueryKey(),
	});
}

export function updateSettingsMutationOptions(queryClient: QueryClient) {
	return mutationOptions({
		mutationFn: async ({ changes, settings }: SettingsChange) =>
			(
				await adminUpdateSettings({
					body: changes,
					headers: ifMatchHeaders(settings.resourceVersion),
				})
			).data,
		onSuccess: (settings) => storeSettings(queryClient, settings),
		meta: { success: 'Settings saved' },
	});
}

export function setMaintenanceModeMutationOptions(queryClient: QueryClient) {
	return appMutationOptions({
		...adminSetMaintenanceModeMutation(),
		onSuccess: (settings) => storeSettings(queryClient, settings),
		meta: {
			success: (settings) =>
				settings.maintenanceMode
					? 'Maintenance mode enabled'
					: 'Maintenance mode disabled',
			failure: 'Failed to change maintenance mode',
		},
	});
}

export function setDrainingPolicyMutationOptions(queryClient: QueryClient) {
	return mutationOptions({
		...adminSetDrainingPolicyMutation(),
		onSuccess: (settings) => storeSettings(queryClient, settings),
		meta: {
			success: 'Draining policy updated',
			failure: 'Failed to update draining policy',
		},
	});
}

interface RegistryUpdate {
	changes: AdminUpdateDockerRegistry;
	registry: DockerRegistry;
}

const registryInvalidates = [adminListPlatformRegistriesQueryKey()];

export function platformRegistriesQueryOptions() {
	return adminListPlatformRegistriesOptions();
}

export function createPlatformRegistryMutationOptions() {
	return mutationOptions({
		mutationFn: (registry: AdminCreateDockerRegistry) =>
			adminCreatePlatformRegistry({
				body: registry,
				headers: idempotencyHeaders(),
			}),
		meta: {
			success: 'Registry created',
			failure: 'Failed to create registry',
			invalidates: registryInvalidates,
		},
	});
}

export function updatePlatformRegistryMutationOptions() {
	return mutationOptions({
		mutationFn: ({ changes, registry }: RegistryUpdate) =>
			adminUpdatePlatformRegistry({ path: { id: registry.id }, body: changes }),
		meta: {
			success: 'Registry updated',
			failure: 'Failed to update registry',
			invalidates: registryInvalidates,
		},
	});
}

export function deletePlatformRegistryMutationOptions() {
	return mutationOptions({
		mutationFn: (registry: DockerRegistry) =>
			adminDeletePlatformRegistry({ path: { id: registry.id } }),
		meta: {
			success: 'Registry deleted',
			failure: 'Failed to delete registry',
			invalidates: registryInvalidates,
		},
	});
}
