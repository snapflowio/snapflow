/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { AuditLog } from '@snapflow/api-client';

const CLIENT_ERROR_STATUS = 400;
const MACHINE_PRINCIPAL = 'Machine principal';

export function matchesAuditSearch(event: AuditLog, search: string): boolean {
	return (
		!search ||
		event.action.toLowerCase().includes(search) ||
		(event.actorEmail?.toLowerCase().includes(search) ?? false) ||
		(event.actorDisplayName?.toLowerCase().includes(search) ?? false) ||
		(event.actorId?.toLowerCase().includes(search) ?? false) ||
		(event.targetType?.toLowerCase().includes(search) ?? false) ||
		(event.targetId?.toLowerCase().includes(search) ?? false) ||
		(event.errorMessage?.toLowerCase().includes(search) ?? false)
	);
}

export function auditActorLabel(event: AuditLog): string {
	return event.actorEmail ?? event.actorDisplayName ?? MACHINE_PRINCIPAL;
}

export function auditStatusVariant(statusCode: number): 'green' | 'red' {
	return statusCode < CLIENT_ERROR_STATUS ? 'green' : 'red';
}

export function auditUnknownLabel(value: unknown): string | undefined {
	if (typeof value === 'string') return value;
	if (value && typeof value === 'object') {
		const entries = Object.values(value).filter(
			(entry) => typeof entry === 'string'
		);
		return entries.length > 0 ? entries.join(', ') : undefined;
	}
	return undefined;
}
