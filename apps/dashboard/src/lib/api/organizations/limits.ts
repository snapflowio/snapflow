/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type CreateQuotaIncreaseRequest,
	createOrganizationQuotaIncreaseRequest,
} from '@snapflow/api-client';
import {
	getOrganizationLimitsOptions,
	getOrganizationQuotaTierOptions,
	getOrganizationUsageOverviewOptions,
	listOrganizationQuotaIncreaseRequestsOptions,
	listOrganizationQuotaIncreaseRequestsQueryKey,
} from '@snapflow/api-client/svelte-query';
import { mutationOptions } from '@tanstack/svelte-query';

export function organizationLimitsQueryOptions() {
	return getOrganizationLimitsOptions();
}

export function organizationUsageQueryOptions() {
	return getOrganizationUsageOverviewOptions();
}

export function organizationQuotaTierQueryOptions() {
	return getOrganizationQuotaTierOptions();
}

export function quotaIncreaseRequestsQueryOptions() {
	return listOrganizationQuotaIncreaseRequestsOptions();
}

export function createQuotaIncreaseRequestMutationOptions() {
	return mutationOptions({
		mutationFn: (request: CreateQuotaIncreaseRequest) =>
			createOrganizationQuotaIncreaseRequest({ body: request }),
		meta: {
			success: 'Request sent',
			failure: 'Failed to send the request',
			invalidates: [listOrganizationQuotaIncreaseRequestsQueryKey()],
		},
	});
}
