/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	deleteActiveOrganization,
	updateOrganizationSettings,
} from '@snapflow/api-client';
import {
	getOrganizationSettingsOptions,
	getOrganizationSettingsQueryKey,
} from '@snapflow/api-client/svelte-query';
import { mutationOptions, type QueryClient } from '@tanstack/svelte-query';
import { authClient } from '#lib/api/auth/client.ts';
import { unwrapAuthResult } from '#lib/api/auth/result.ts';

export interface OrganizationIdentityValues {
	name: string;
	slug: string;
}

export interface OrganizationDefaultsValues {
	sandboxLimitedNetworkEgress: boolean;
	telemetryEnabled: boolean;
}

export interface IdentityChange {
	data: OrganizationIdentityValues;
	organizationId: string;
}

export interface DefaultsChange {
	initial: OrganizationDefaultsValues;
	values: OrganizationDefaultsValues;
}

async function saveDefaults({ initial, values }: DefaultsChange) {
	if (
		values.telemetryEnabled !== initial.telemetryEnabled ||
		values.sandboxLimitedNetworkEgress !== initial.sandboxLimitedNetworkEgress
	) {
		await updateOrganizationSettings({
			body: {
				telemetryEnabled: values.telemetryEnabled,
				sandboxLimitedNetworkEgress: values.sandboxLimitedNetworkEgress,
			},
		});
	}
}

export function organizationSettingsQueryOptions() {
	return getOrganizationSettingsOptions();
}

export function organizationIdentityMutationOptions() {
	return mutationOptions({
		mutationFn: async ({ data, organizationId }: IdentityChange) =>
			unwrapAuthResult(
				await authClient.organization.update({ organizationId, data })
			),
		meta: {
			success: 'Organization updated',
			failure: 'Failed to update organization',
		},
	});
}

export function organizationDefaultsMutationOptions(queryClient: QueryClient) {
	return mutationOptions({
		mutationFn: saveDefaults,
		onSettled: () =>
			queryClient.invalidateQueries({
				queryKey: getOrganizationSettingsQueryKey(),
			}),
		meta: {
			success: 'Organization defaults updated',
			failure: 'Failed to update organization defaults',
		},
	});
}

export function deleteOrganizationMutationOptions() {
	return mutationOptions({
		mutationFn: () => deleteActiveOrganization(),
		meta: { failure: 'Failed to delete organization' },
	});
}
