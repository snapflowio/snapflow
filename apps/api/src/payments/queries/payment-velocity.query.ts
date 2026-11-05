/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { parseDatabaseTimestamp } from '../../infra/database/utils/database-time.util';
import type { FingerprintOrganization } from '../utils/payment-velocity.util';

export async function fingerprintOrganizations(
	manager: EntityManager,
	cardFingerprint: string
): Promise<FingerprintOrganization[]> {
	const rows = await manager.execute<
		{ organizationId: string; createdAt: unknown }[]
	>(
		`SELECT DISTINCT organization.id AS "organizationId",
				organization."createdAt" AS "createdAt"
		 FROM "payment_method" method
		 INNER JOIN "organization" organization
			ON organization.id = method."organizationId"
		 WHERE method."cardFingerprint" = ?
		   AND organization."deletedAt" IS NULL`,
		[cardFingerprint]
	);
	return rows.map((row) => ({
		organizationId: row.organizationId,
		createdAt: parseDatabaseTimestamp(row.createdAt),
	}));
}
