/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import type { Exposure } from '../../networking/entities/exposure.entity';
import { AbuseHostnameKind } from '../constants/abuse-report.constants';
import type { AbuseHostname } from '../entities/abuse-hostname.entity';

export type AbuseHostnameAssignment = Pick<
	AbuseHostname,
	'hostname' | 'kind' | 'sandboxId' | 'organizationId' | 'exposureId'
>;

const LIVE_HOSTNAMES = `
	SELECT exposure."platformHostname" AS hostname, exposure."sandboxId"
	FROM sandbox_exposure exposure WHERE exposure."platformHostname" IS NOT NULL
	UNION ALL
	SELECT exposure."originHostname", exposure."sandboxId"
	FROM sandbox_exposure exposure WHERE exposure."originHostname" IS NOT NULL
	UNION ALL
	SELECT domain.hostname, domain."sandboxId"
	FROM sandbox_custom_domain domain
	UNION ALL
	SELECT lower(backend."publicHost") || ':' || backend."publicPort", backend."sandboxId"
	FROM sandbox_exposure_backend backend
	WHERE backend.protocol <> 'http' AND backend."publicPort" IS NOT NULL`;

const RELEASE_HOSTNAMES_SQL = `
	WITH live AS (${LIVE_HOSTNAMES})
	UPDATE abuse_hostname history SET "releasedAt" = now()
	WHERE history."releasedAt" IS NULL
	  AND NOT EXISTS (
		SELECT 1 FROM live
		WHERE lower(live.hostname) = history.hostname AND live."sandboxId" = history."sandboxId"
	  )`;

const ASSIGNMENT_ROW = '(?, ?, ?, ?, ?, now())';

const ASSIGNMENT_CONFLICT = `
	ON CONFLICT (hostname, "sandboxId") DO UPDATE SET "releasedAt" = NULL
	WHERE abuse_hostname."releasedAt" IS NOT NULL`;

const LOOKUP_HOSTNAME_SQL = `
	SELECT history."sandboxId", history."organizationId", history.kind, sandbox."machineId"
	FROM abuse_hostname history
	LEFT JOIN sandbox ON sandbox.id = history."sandboxId"
	WHERE history.hostname = ?
	  AND history."assignedAt" <= ?
	  AND (history."releasedAt" IS NULL OR history."releasedAt" >= ?)
	ORDER BY history."releasedAt" DESC NULLS FIRST, history."assignedAt" DESC
	LIMIT 1`;

export async function recordAbuseHostnames(
	manager: EntityManager,
	assignments: readonly AbuseHostnameAssignment[]
): Promise<void> {
	const unique = new Map(
		assignments.map((assignment) => {
			const hostname = assignment.hostname.toLowerCase();
			return [
				`${hostname} ${assignment.sandboxId}`,
				{ ...assignment, hostname },
			];
		})
	);
	if (unique.size === 0) return;
	const rows = [...unique.values()];
	await manager.execute(
		`INSERT INTO abuse_hostname (hostname, kind, "sandboxId", "organizationId", "exposureId", "assignedAt")
		VALUES ${rows.map(() => ASSIGNMENT_ROW).join(', ')}${ASSIGNMENT_CONFLICT}`,
		rows.flatMap((row) => [
			row.hostname,
			row.kind,
			row.sandboxId,
			row.organizationId,
			row.exposureId,
		])
	);
}

export function exposureAbuseHostnames(
	exposure: Pick<
		Exposure,
		| 'id'
		| 'sandboxId'
		| 'organizationId'
		| 'platformHostname'
		| 'originHostname'
	>
): AbuseHostnameAssignment[] {
	const owner = {
		sandboxId: exposure.sandboxId,
		organizationId: exposure.organizationId,
		exposureId: exposure.id,
	};
	return [
		...(exposure.platformHostname
			? [
					{
						...owner,
						hostname: exposure.platformHostname,
						kind: AbuseHostnameKind.PREVIEW,
					},
				]
			: []),
		...(exposure.originHostname
			? [
					{
						...owner,
						hostname: exposure.originHostname,
						kind: AbuseHostnameKind.ORIGIN,
					},
				]
			: []),
	];
}

export async function releaseAbuseHostnames(
	manager: EntityManager
): Promise<void> {
	await manager.execute(RELEASE_HOSTNAMES_SQL);
}

export async function hostnameOwner(
	manager: EntityManager,
	hostname: string,
	window: { from: Date; until: Date }
) {
	const [row] = await manager.execute<
		{
			sandboxId: string;
			organizationId: string;
			machineId: string | null;
			kind: AbuseHostnameKind;
		}[]
	>(LOOKUP_HOSTNAME_SQL, [hostname.toLowerCase(), window.until, window.from]);
	return row ?? null;
}

export type HostnameOwner = NonNullable<
	Awaited<ReturnType<typeof hostnameOwner>>
>;
