/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	acceptHostTerms,
	type UpdateHostProfile,
	updateHostProfile,
} from '@snapflow/api-client';
import {
	getHostProfileOptions,
	getHostProfileQueryKey,
	getListingHostOptions,
	listHostMachinesQueryKey,
	listListingsQueryKey,
} from '@snapflow/api-client/svelte-query';
import { mutationOptions, queryOptions } from '@tanstack/svelte-query';

export function hostProfileQueryOptions() {
	return getHostProfileOptions();
}

export function listingHostQueryOptions(machineId: string) {
	return queryOptions({
		...getListingHostOptions({ path: { machineId } }),
		retry: false,
	});
}

export function updateHostProfileMutationOptions() {
	return mutationOptions({
		mutationFn: async (body: UpdateHostProfile) =>
			(await updateHostProfile({ body })).data,
		onSuccess: (profile, _body, _result, context) => {
			context.client.setQueryData(getHostProfileQueryKey(), profile);
		},
		meta: {
			invalidates: [listListingsQueryKey(), listHostMachinesQueryKey()],
			success: 'Host profile saved',
			failure: 'Failed to save the host profile',
		},
	});
}

export function acceptHostTermsMutationOptions() {
	return mutationOptions({
		mutationFn: async (version: string) =>
			(await acceptHostTerms({ body: { version } })).data,
		onSuccess: (profile, _version, _result, context) => {
			context.client.setQueryData(getHostProfileQueryKey(), profile);
		},
		meta: {
			success: 'Host terms accepted',
			failure: 'Failed to record the host terms acceptance',
		},
	});
}
