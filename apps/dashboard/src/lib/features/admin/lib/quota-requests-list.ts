/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type AdminQuotaIncreaseRequest,
	QuotaIncreaseRequestStatus,
} from '@snapflow/api-client';
import * as z from 'zod';
import {
	adminSearchField,
	adminSortFields,
} from '#lib/features/admin/lib/admin-list.ts';
import { sandboxClassLabel } from '#lib/features/sandboxes/lib/sandbox-state.ts';

const ALL_REQUESTS = 'all';

export const QUOTA_REQUEST_STATUS_OPTIONS = [
	{ label: 'Pending', value: QuotaIncreaseRequestStatus.Pending },
];

export const QUOTA_REQUEST_SORT_OPTIONS = [
	{ id: 'sent', label: 'Sent' },
	{ id: 'reviewed', label: 'Reviewed' },
] as const;

export const QUOTA_REQUEST_FILTER_KEYS = ['status'] as const;

export const QUOTA_REQUEST_CLEARED_FILTERS = { status: ALL_REQUESTS } as const;

export const QUOTA_REQUEST_EMPTY_MESSAGES = {
	[QuotaIncreaseRequestStatus.Pending]: 'No requests need a decision',
	[ALL_REQUESTS]: 'No quota requests yet',
} as const;

export const quotaRequestsSearchSchema = z.object({
	q: adminSearchField,
	...adminSortFields(['sent', 'reviewed']),
	status: z
		.enum([QuotaIncreaseRequestStatus.Pending, ALL_REQUESTS])
		.catch(QuotaIncreaseRequestStatus.Pending),
});

export function isPendingRequest(request: AdminQuotaIncreaseRequest): boolean {
	return request.status === QuotaIncreaseRequestStatus.Pending;
}

export function showsPendingRequestsOnly(status: string): boolean {
	return status === QuotaIncreaseRequestStatus.Pending;
}

export function requestedLimitsSummary(
	request: AdminQuotaIncreaseRequest
): string {
	return `${request.requestedCpu} vCPUs · ${request.requestedMemory} GiB memory · ${request.requestedDisk} GiB disk · ${request.requestedGpu} GPUs`;
}

export function requestClassLabel(request: AdminQuotaIncreaseRequest): string {
	return sandboxClassLabel(request.sandboxClass);
}

export function requestStatusFilterValues(
	status: string
): QuotaIncreaseRequestStatus[] {
	return showsPendingRequestsOnly(status)
		? [QuotaIncreaseRequestStatus.Pending]
		: [];
}

export function requestStatusFromFilter(
	values: readonly QuotaIncreaseRequestStatus[]
): z.infer<typeof quotaRequestsSearchSchema>['status'] {
	return values.length > 0 ? QuotaIncreaseRequestStatus.Pending : ALL_REQUESTS;
}
