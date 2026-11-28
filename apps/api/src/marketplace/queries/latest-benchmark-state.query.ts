/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { MachineBenchmark } from '../../verification/entities/machine-benchmark.entity';
import type { BenchmarkState } from '../../verification/enums/benchmark-state.enum';

interface LatestBenchmarkRow {
	machineId: string;
	state: BenchmarkState;
}

export async function latestBenchmarkStates(
	manager: EntityManager,
	machineIds: readonly string[]
): Promise<Map<string, BenchmarkState>> {
	if (machineIds.length === 0) return new Map();
	const rows = await manager.execute<LatestBenchmarkRow[]>(
		`SELECT DISTINCT ON ("machineId") "machineId", state
		FROM machine_benchmark
		WHERE "machineId" = ANY(ARRAY[?]::uuid[])
		ORDER BY "machineId", "issuedAt" DESC`,
		[machineIds]
	);
	return new Map(rows.map((row) => [row.machineId, row.state]));
}

interface BenchmarkIdRow {
	id: string;
}

export async function latestBenchmarks(
	manager: EntityManager,
	machineIds: readonly string[]
): Promise<Map<string, MachineBenchmark>> {
	if (machineIds.length === 0) return new Map();
	const rows = await manager.execute<BenchmarkIdRow[]>(
		`SELECT DISTINCT ON ("machineId") id
		FROM machine_benchmark
		WHERE "machineId" = ANY(ARRAY[?]::uuid[])
		ORDER BY "machineId", "issuedAt" DESC`,
		[machineIds]
	);
	if (rows.length === 0) return new Map();
	const benchmarks = await manager.find(MachineBenchmark, {
		id: { $in: rows.map((row) => row.id) },
	});
	return new Map(
		benchmarks.map((benchmark) => [benchmark.machineId, benchmark])
	);
}

interface CurrentBenchmarkRow {
	machineId: string;
	validUntil: Date;
}

export async function currentBenchmarkExpiries(
	manager: EntityManager,
	machineIds: readonly string[]
): Promise<Map<string, Date>> {
	if (machineIds.length === 0) return new Map();
	const rows = await manager.execute<CurrentBenchmarkRow[]>(
		`SELECT machine.id AS "machineId", passed."validUntil" AS "validUntil"
		FROM machine
		JOIN machine_benchmark passed ON passed.id = machine."latestBenchmarkId"
		WHERE machine.id = ANY(ARRAY[?]::uuid[])
		  AND passed."validUntil" > now()`,
		[machineIds]
	);
	return new Map(rows.map((row) => [row.machineId, new Date(row.validUntil)]));
}
