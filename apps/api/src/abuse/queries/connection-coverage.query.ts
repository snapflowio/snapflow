/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';

const RECORD_COVERAGE_SQL = `
	INSERT INTO machine_connection_coverage ("machineId", "bucketStart", covered, "overflowWorkloadIds")
	SELECT ?, bucket,
		CASE WHEN ?::boolean
			THEN tstzmultirange(tstzrange(?::timestamptz, ?::timestamptz, '[]'))
			ELSE '{}'::tstzmultirange
		END,
		ARRAY[?]::text[]
	FROM generate_series(
		date_trunc('hour', ?::timestamptz),
		date_trunc('hour', ?::timestamptz),
		interval '1 hour'
	) AS bucket
	ON CONFLICT ("machineId", "bucketStart") DO UPDATE SET
		covered = machine_connection_coverage.covered + EXCLUDED.covered,
		"overflowWorkloadIds" = ARRAY(
			SELECT DISTINCT unnest(machine_connection_coverage."overflowWorkloadIds" || EXCLUDED."overflowWorkloadIds")
		)`;

const COVERAGE_SQL = `
	SELECT
		?::timestamptz < date_trunc('hour', now() - make_interval(secs => ?)) + interval '1 hour' AS expired,
		COALESCE(range_agg(covered) @> tstzrange(?::timestamptz, ?::timestamptz, '[]'), false) AS covered,
		COALESCE(bool_or(cardinality("overflowWorkloadIds") > 0), false) AS overflowed
	FROM machine_connection_coverage
	WHERE "machineId" = ?
	  AND "bucketStart" >= date_trunc('hour', ?::timestamptz)
	  AND "bucketStart" <= ?::timestamptz`;

const EXPIRE_SQL = `
	DELETE FROM machine_connection_coverage
	WHERE "bucketStart" < now() - make_interval(secs => ?)`;

export async function recordConnectionCoverage(
	manager: EntityManager,
	machineId: string,
	report: {
		windowStart: Date;
		windowEnd: Date;
		complete: boolean;
		overflowWorkloadIds: readonly string[];
	}
): Promise<void> {
	await manager.execute(RECORD_COVERAGE_SQL, [
		machineId,
		report.complete,
		report.windowStart,
		report.windowEnd,
		[...report.overflowWorkloadIds],
		report.windowStart,
		report.windowEnd,
	]);
}

export async function connectionCoverage(
	manager: EntityManager,
	machineId: string,
	window: { from: Date; until: Date },
	retentionSeconds: number
) {
	const [row] = await manager.execute<
		{ expired: boolean; covered: boolean; overflowed: boolean }[]
	>(COVERAGE_SQL, [
		window.from,
		retentionSeconds,
		window.from,
		window.until,
		machineId,
		window.from,
		window.until,
	]);
	return {
		expired: row?.expired ?? true,
		covered: row?.covered ?? false,
		overflowed: row?.overflowed ?? false,
	};
}

export async function expireConnectionCoverage(
	manager: EntityManager,
	retentionSeconds: number
): Promise<void> {
	await manager.execute(EXPIRE_SQL, [retentionSeconds]);
}
