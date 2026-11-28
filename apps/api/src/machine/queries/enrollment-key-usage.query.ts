/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';

interface EnrollmentKeyUsageRow {
	enrollmentKeyId: string;
	machineCount: number;
}

export async function enrollmentKeyMachineCounts(
	manager: EntityManager,
	organizationId: string,
	keyIds: readonly string[]
): Promise<Map<string, number>> {
	if (keyIds.length === 0) return new Map();
	const rows = await manager.execute<EnrollmentKeyUsageRow[]>(
		`SELECT "enrollmentKeyId", count(*)::int AS "machineCount"
		FROM machine
		WHERE "organizationId" = ? AND "enrollmentKeyId" = ANY(ARRAY[?]::uuid[])
		GROUP BY "enrollmentKeyId"`,
		[organizationId, keyIds]
	);
	return new Map(rows.map((row) => [row.enrollmentKeyId, row.machineCount]));
}
