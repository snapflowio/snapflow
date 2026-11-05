/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { AuditLogMetadata } from '../entities/audit-log.entity';

const SENSITIVE_METADATA_KEY =
	/(authorization|cookie|credential|dpop|password|private.?key|secret|token|value)/i;
const MAXIMUM_AUDIT_METADATA_DEPTH = 8;

export function sanitizeAuditMetadata(
	metadata: AuditLogMetadata
): AuditLogMetadata {
	return sanitizeRecord(metadata, 0);
}

function sanitizeRecord(
	value: Record<string, unknown>,
	depth: number
): AuditLogMetadata {
	if (depth >= MAXIMUM_AUDIT_METADATA_DEPTH) return {};
	return Object.fromEntries(
		Object.entries(value).flatMap(([key, item]) => {
			if (SENSITIVE_METADATA_KEY.test(key)) return [];
			return [[key, sanitizeValue(item, depth + 1)]];
		})
	);
}

function sanitizeValue(value: unknown, depth: number): unknown {
	if (typeof value !== 'object' || value === null) return value;
	if (Array.isArray(value)) {
		return value.map((entry) => sanitizeValue(entry, depth + 1));
	}
	return sanitizeRecord(value as Record<string, unknown>, depth);
}
