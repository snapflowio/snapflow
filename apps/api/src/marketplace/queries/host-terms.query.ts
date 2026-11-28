/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';

const ACCEPT_HOST_TERMS_SQL = `INSERT INTO host_profile ("organizationId", "displayName", "hostTermsVersion", "hostTermsAcceptedAt", "hostTermsAcceptedBy")
	SELECT organization.id, organization.name, ?, now(), ? FROM organization WHERE organization.id = ?
	ON CONFLICT ("organizationId") DO UPDATE SET
		"hostTermsVersion" = excluded."hostTermsVersion",
		"hostTermsAcceptedAt" = excluded."hostTermsAcceptedAt",
		"hostTermsAcceptedBy" = excluded."hostTermsAcceptedBy",
		"updatedAt" = now()`;

const HOST_TERMS_VERSION_SQL = `SELECT "hostTermsVersion" AS version FROM host_profile WHERE "organizationId" = ?`;

export async function recordHostTermsAcceptance(
	manager: EntityManager,
	organizationId: string,
	userId: string,
	version: string
): Promise<void> {
	await manager.execute(ACCEPT_HOST_TERMS_SQL, [
		version,
		userId,
		organizationId,
	]);
}

export async function acceptedHostTermsVersion(
	manager: EntityManager,
	organizationId: string
): Promise<string | null> {
	const [row] = await manager.execute<{ version: string | null }[]>(
		HOST_TERMS_VERSION_SQL,
		[organizationId]
	);
	return row?.version ?? null;
}
