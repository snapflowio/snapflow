/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';

const LAST_CHARGED_HOURS_SQL = `SELECT charge."organizationId", max(charge."serviceHour") AS "serviceHour"
	FROM storage_charge charge
	WHERE charge."organizationId" = ANY(ARRAY[?]::uuid[])
	GROUP BY charge."organizationId"`;

export async function lastStorageChargeHours(
	manager: EntityManager,
	organizationIds: readonly string[]
): Promise<Map<string, Date>> {
	if (organizationIds.length === 0) return new Map();
	const rows = await manager.execute<
		{ organizationId: string; serviceHour: Date }[]
	>(LAST_CHARGED_HOURS_SQL, [organizationIds]);
	return new Map(
		rows.map(({ organizationId, serviceHour }) => [
			organizationId,
			new Date(serviceHour),
		])
	);
}
