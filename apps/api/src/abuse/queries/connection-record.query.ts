/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { JobType } from '../../machine-job/enums/job-type.enum';
import {
	CONNECTION_RECORDS,
	type ConnectionWorkloadKind,
	type IspComplaintProtocol,
} from '../constants/isp-complaint.constants';
import type { MachineConnectionFlowDto } from '../dto/machine-connection-report.dto';

const ROWS_PER_STATEMENT = 500;
const ATTRIBUTION_SAMPLE = 2;

const ROW_PLACEHOLDER = `(?, ?, ?, ?, ?, ?, ?, date_trunc('hour', ?::timestamptz), ?, ?)`;

const UPSERT_TAIL = `
	ON CONFLICT ("workloadId", "destinationAddress", "destinationPort", protocol, "bucketStart")
	DO UPDATE SET
		"firstSeenAt" = LEAST(sandbox_connection_record."firstSeenAt", EXCLUDED."firstSeenAt"),
		"lastSeenAt" = GREATEST(sandbox_connection_record."lastSeenAt", EXCLUDED."lastSeenAt")`;

const ATTRIBUTION_SQL = `
	SELECT DISTINCT "workloadId", "workloadKind", "organizationId"
	FROM sandbox_connection_record
	WHERE "machineId" = ? AND "destinationAddress" = ? AND protocol = ?
	  AND (?::integer IS NULL OR "destinationPort" = ?::integer)
	  AND "firstSeenAt" <= ? AND "lastSeenAt" >= ?
	LIMIT ${ATTRIBUTION_SAMPLE}`;

const PLACED_SANDBOXES_SQL = `
	SELECT DISTINCT sandbox.id, sandbox."organizationId"
	FROM sandbox
	JOIN sandbox_placement placement ON placement."sandboxId" = sandbox.id
	WHERE sandbox.id = ANY(ARRAY[?]::varchar[])
	  AND placement."machineId" = ?
	  AND placement."placedAt" <= ?
	  AND (
		placement."releasedAt" IS NULL
		OR placement."releasedAt" + make_interval(secs => ?) >= ?
	  )`;

const BUILDING_ORGANIZATIONS_SQL = `
	SELECT DISTINCT job.payload::jsonb ->> 'ownerId' AS "organizationId"
	FROM job
	WHERE job."machineId" = ?
	  AND job.type = ?
	  AND CASE WHEN job.type = ? THEN job.payload::jsonb ->> 'ownerId' END = ANY(ARRAY[?]::text[])
	  AND job."createdAt" <= ?
	  AND (
		job."completedAt" IS NULL
		OR job."completedAt" + make_interval(secs => ?) >= ?
	  )`;

const EXPIRE_SQL = `
	DELETE FROM sandbox_connection_record
	WHERE id IN (
		SELECT id FROM sandbox_connection_record
		WHERE "bucketStart" < now() - make_interval(secs => ?)
		LIMIT ?
	)
	RETURNING id`;

export type ConnectionRow = MachineConnectionFlowDto & {
	workloadId: string;
	workloadKind: ConnectionWorkloadKind;
	organizationId: string;
	machineId: string;
};

type ReportWindow = { windowStart: Date; windowEnd: Date };

export async function upsertConnectionRecords(
	manager: EntityManager,
	rows: readonly ConnectionRow[]
): Promise<void> {
	for (let offset = 0; offset < rows.length; offset += ROWS_PER_STATEMENT) {
		const batch = rows.slice(offset, offset + ROWS_PER_STATEMENT);
		const values = batch.flatMap((row) => [
			row.workloadId,
			row.workloadKind,
			row.organizationId,
			row.machineId,
			row.destinationAddress,
			row.destinationPort,
			row.protocol,
			row.firstSeenAt,
			row.firstSeenAt,
			row.lastSeenAt,
		]);
		await manager.execute(
			`INSERT INTO sandbox_connection_record
				("workloadId", "workloadKind", "organizationId", "machineId", "destinationAddress", "destinationPort", protocol, "bucketStart", "firstSeenAt", "lastSeenAt")
			VALUES ${batch.map(() => ROW_PLACEHOLDER).join(', ')}${UPSERT_TAIL}`,
			values
		);
	}
}

export async function sandboxesPlacedOnMachine(
	manager: EntityManager,
	machineId: string,
	sandboxIds: readonly string[],
	window: ReportWindow
) {
	if (sandboxIds.length === 0) return [];
	return manager.execute<{ id: string; organizationId: string }[]>(
		PLACED_SANDBOXES_SQL,
		[
			[...new Set(sandboxIds)],
			machineId,
			window.windowEnd,
			CONNECTION_RECORDS.releaseGraceSeconds,
			window.windowStart,
		]
	);
}

export async function organizationsBuildingOnMachine(
	manager: EntityManager,
	machineId: string,
	organizationIds: readonly string[],
	window: ReportWindow
): Promise<Set<string>> {
	if (organizationIds.length === 0) return new Set();
	const rows = await manager.execute<{ organizationId: string }[]>(
		BUILDING_ORGANIZATIONS_SQL,
		[
			machineId,
			JobType.BUILD_SNAPSHOT,
			JobType.BUILD_SNAPSHOT,
			[...new Set(organizationIds)],
			window.windowEnd,
			CONNECTION_RECORDS.releaseGraceSeconds,
			window.windowStart,
		]
	);
	return new Set(rows.map((row) => row.organizationId));
}

export async function attributedWorkloads(
	manager: EntityManager,
	query: {
		machineId: string;
		destinationAddress: string;
		destinationPort: number | null;
		protocol: IspComplaintProtocol;
		from: Date;
		until: Date;
	}
) {
	return manager.execute<
		{
			workloadId: string;
			workloadKind: ConnectionWorkloadKind;
			organizationId: string;
		}[]
	>(ATTRIBUTION_SQL, [
		query.machineId,
		query.destinationAddress,
		query.protocol,
		query.destinationPort,
		query.destinationPort,
		query.until,
		query.from,
	]);
}

export async function expireConnectionRecords(
	manager: EntityManager,
	retentionSeconds: number,
	batchSize: number
): Promise<number> {
	const deleted = await manager.execute<{ id: string }[]>(EXPIRE_SQL, [
		retentionSeconds,
		batchSize,
	]);
	return deleted.length;
}
