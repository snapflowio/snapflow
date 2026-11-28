/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { getAuditLogsInfiniteOptions } from '@snapflow/api-client/svelte-query';

const AUDIT_PAGE_SIZE = 100;

export interface AuditLogsQuery {
	from: string;
	to: string;
}

function toIsoDate(value: string): string | undefined {
	return value ? new Date(value).toISOString() : undefined;
}

export function auditLogsInfiniteQueryOptions({ from, to }: AuditLogsQuery) {
	return getAuditLogsInfiniteOptions({
		query: {
			limit: AUDIT_PAGE_SIZE,
			from: toIsoDate(from),
			to: toIsoDate(to),
		},
	});
}
