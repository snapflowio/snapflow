/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { EFFECTIVE_BILLING_LINE_AMOUNT_SQL } from '../../billing/utils/line-item/billing-line-query.util';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { MachineState } from '../../machine/enums/machine-state.enum';
import { ListingVisibility } from '../../marketplace/enums/listing-visibility.enum';
import { MachineTier } from '../../marketplace/enums/machine-tier.enum';
import { MachineBenchmark } from '../entities/machine-benchmark.entity';
import { MachineSpotCheck } from '../entities/machine-spot-check.entity';
import { BenchmarkState } from '../enums/benchmark-state.enum';
import { BenchmarkTrigger } from '../enums/benchmark-trigger.enum';
import { SpotCheckState } from '../enums/spot-check-state.enum';

const EPOCH = new Date(0);

export async function lastVerifiedPassAt(
	manager: EntityManager,
	machineId: string,
	before: Date
): Promise<Date> {
	const [benchmark, spotCheck] = await Promise.all([
		manager.findOne(
			MachineBenchmark,
			{
				machineId,
				state: BenchmarkState.PASSED,
				completedAt: { $lt: before },
			},
			{ orderBy: { completedAt: 'DESC' } }
		),
		manager.findOne(
			MachineSpotCheck,
			{
				machineId,
				state: SpotCheckState.PASSED,
				completedAt: { $lt: before },
			},
			{ orderBy: { completedAt: 'DESC' } }
		),
	]);
	const passes = [benchmark?.completedAt, spotCheck?.completedAt].filter(
		(passedAt): passedAt is Date => passedAt instanceof Date
	);
	return passes.reduce(
		// biome-ignore lint/complexity/useMathMinMax: Date operands, which Math.max would turn into numbers
		(latest, passedAt) => (passedAt > latest ? passedAt : latest),
		EPOCH
	);
}

interface ChargesRow {
	chargedMicroUsd: string;
}

export async function machineChargesSince(
	manager: EntityManager,
	machineId: string,
	since: Date
): Promise<MicroUsd> {
	const [row] = await manager.execute<ChargesRow[]>(
		`SELECT COALESCE(SUM(${EFFECTIVE_BILLING_LINE_AMOUNT_SQL}), 0)::text AS "chargedMicroUsd"
		   FROM "billing_line_item" line
		  WHERE line."machineId" = ?
		    AND line."periodEnd" > ?`,
		[machineId, since]
	);
	return row ? MicroUsd.parse(row.chargedMicroUsd) : MicroUsd.ZERO;
}

interface SpendRow {
	spendMicroUsd: string;
}

export async function organizationSpendSince(
	manager: EntityManager,
	organizationId: string,
	since: Date
): Promise<MicroUsd> {
	const [row] = await manager.execute<SpendRow[]>(
		`SELECT COALESCE(SUM(line."grossMicroUsd"), 0)::text AS "spendMicroUsd"
		   FROM "billing_line_item" line
		  WHERE line."customerOrganizationId" = ?
		    AND line."periodEnd" > ?`,
		[organizationId, since]
	);
	return row ? MicroUsd.parse(row.spendMicroUsd) : MicroUsd.ZERO;
}

interface BenchmarkDueRow {
	machineId: string;
	trigger: BenchmarkTrigger;
}

interface BenchmarkDueWindow {
	now: Date;
	renewalHorizon: Date;
	limit: number;
}

export function findMachinesDueForBenchmark(
	manager: EntityManager,
	window: BenchmarkDueWindow
): Promise<BenchmarkDueRow[]> {
	return manager.execute<BenchmarkDueRow[]>(
		`SELECT machine.id AS "machineId",
		        CASE
		          WHEN latest.id IS NULL THEN ?
		          WHEN latest.state = ? THEN ?
		          WHEN machine."inventoryDigest" IS NOT NULL
		               AND machine."inventoryDigest" IS DISTINCT FROM latest."inventoryDigest" THEN ?
		          WHEN latest.state = ? THEN ?
		          ELSE ?
		        END AS "trigger"
		   FROM "machine" machine
		   LEFT JOIN LATERAL (
		     SELECT benchmark.id, benchmark.state, benchmark."nextAttemptAt",
		            benchmark."inventoryDigest", benchmark.release
		       FROM "machine_benchmark" benchmark
		      WHERE benchmark."machineId" = machine.id
		      ORDER BY benchmark."issuedAt" DESC
		      LIMIT 1
		   ) latest ON TRUE
		   LEFT JOIN "machine_benchmark" passed ON passed.id = machine."latestBenchmarkId"
		  WHERE machine.state = ?
		    AND machine."identityKeyId" IS NOT NULL
		    AND (
		      latest.id IS NULL
		      OR (latest.state = ? AND latest."nextAttemptAt" <= ?)
		      OR (latest.state IN (?, ?)
		          AND machine."inventoryDigest" IS NOT NULL
		          AND machine."inventoryDigest" IS DISTINCT FROM latest."inventoryDigest")
		      OR (latest.state = ? AND machine."appVersion" IS DISTINCT FROM latest.release)
		      OR (latest.state = ? AND passed."validUntil" <= ?)
		    )
		  ORDER BY machine.id
		  LIMIT ?`,
		[
			BenchmarkTrigger.REGISTRATION,
			BenchmarkState.DEFERRED,
			BenchmarkTrigger.RETRY,
			BenchmarkTrigger.INVENTORY_CHANGE,
			BenchmarkState.FAILED,
			BenchmarkTrigger.RELEASE_CHANGE,
			BenchmarkTrigger.RENEWAL,
			MachineState.READY,
			BenchmarkState.DEFERRED,
			window.now,
			BenchmarkState.PASSED,
			BenchmarkState.FAILED,
			BenchmarkState.FAILED,
			BenchmarkState.PASSED,
			window.renewalHorizon,
			window.limit,
		]
	);
}

interface SpotCheckCandidateRow {
	machineId: string;
	tier: MachineTier;
}

export function findSpotCheckCandidates(
	manager: EntityManager,
	limit: number
): Promise<SpotCheckCandidateRow[]> {
	return manager.execute<SpotCheckCandidateRow[]>(
		`SELECT machine.id AS "machineId", machine.tier AS "tier"
		   FROM "machine" machine
		   JOIN "machine_listing" listing ON listing."machineId" = machine.id
		  WHERE machine.tier <> ?
		    AND machine."restrictedAt" IS NULL
		    AND listing.visibility = ?
		    AND NOT EXISTS (
		      SELECT 1 FROM "machine_spot_check" check_row
		       WHERE check_row."machineId" = machine.id
		         AND check_row.state IN (?, ?)
		    )
		  ORDER BY machine.id
		  LIMIT ?`,
		[
			MachineTier.PRIVATE,
			ListingVisibility.PUBLIC,
			SpotCheckState.SCHEDULED,
			SpotCheckState.RUNNING,
			limit,
		]
	);
}
