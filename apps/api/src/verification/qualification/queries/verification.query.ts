/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import {
	BILLING_LEDGER_SOURCE_VERSION,
	type BillingChargeClass,
	BillingLedgerAccountCode,
	BillingLedgerSourceType,
} from '../../../billing/ledger/constants/billing.constants';
import type { ForfeitableLine } from '../../../billing/ledger/utils/ledger/billing-forfeiture-posting.util';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import { ListingVisibility } from '../../../marketplace/machine/enums/listing-visibility.enum';
import { MachineTier } from '../../../marketplace/machine/enums/machine-tier.enum';
import { MachineState } from '../../../sandbox/machine/enums/machine-state.enum';
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
		(latest, passedAt) => (passedAt > latest ? passedAt : latest),
		EPOCH
	);
}

interface ForfeitableLineRow {
	lineId: string;
	customerOrganizationId: string;
	hostOrganizationId: string;
	grossMicroUsd: string;
	hostMicroUsd: string;
	markupMicroUsd: string;
}

export async function findForfeitableLines(
	manager: EntityManager,
	machineId: string,
	since: Date,
	chargeClasses: readonly BillingChargeClass[]
): Promise<ForfeitableLine[]> {
	await manager.execute(
		`SELECT id FROM "billing_line_item"
		  WHERE "machineId" = ? AND "periodEnd" > ? AND "earningsReleasedAt" IS NULL
		    AND "chargeClass" = ANY(ARRAY[?]::varchar[])
		  ORDER BY id
		  FOR UPDATE`,
		[machineId, since, chargeClasses]
	);
	const rows = await manager.execute<ForfeitableLineRow[]>(
		`SELECT line.id AS "lineId",
		        line."customerOrganizationId" AS "customerOrganizationId",
		        line."hostOrganizationId" AS "hostOrganizationId",
		        SUM(CASE WHEN account."accountCode" = ? THEN entry.amount ELSE 0 END)::text AS "grossMicroUsd",
		        SUM(CASE WHEN account."accountCode" = ? THEN entry.amount ELSE 0 END)::text AS "hostMicroUsd",
		        SUM(CASE WHEN account."accountCode" = ? THEN entry.amount ELSE 0 END)::text AS "markupMicroUsd"
		   FROM "billing_line_item" line
		   JOIN "billing_ledger_transaction" posting
		     ON posting."sourceType" = ?
		    AND posting."sourceReference" = line.id::text
		    AND posting."sourceVersion" = ?
		   JOIN "billing_ledger_entry" entry ON entry."transactionId" = posting.id
		   JOIN "billing_ledger_account" account ON account.id = entry."accountId"
		  WHERE line."machineId" = ?
		    AND line."periodEnd" > ?
		    AND line."hostOrganizationId" IS NOT NULL
		    AND line."hostMicroUsd" > 0
		    AND line."earningsReleasedAt" IS NULL
		    AND line."chargeClass" = ANY(ARRAY[?]::varchar[])
		    AND NOT EXISTS (
		      SELECT 1 FROM "billing_ledger_transaction" forfeiture
		       WHERE forfeiture."sourceType" = ?
		         AND forfeiture."sourceReference" = line.id::text
		    )
		  GROUP BY line.id
		  ORDER BY line.id`,
		[
			BillingLedgerAccountCode.CUSTOMER_CREDIT,
			BillingLedgerAccountCode.HOST_EARNINGS_PENDING,
			BillingLedgerAccountCode.PLATFORM_MARKUP_REVENUE,
			BillingLedgerSourceType.LINE_USAGE,
			BILLING_LEDGER_SOURCE_VERSION,
			machineId,
			since,
			chargeClasses,
			BillingLedgerSourceType.EARNINGS_FORFEITURE,
		]
	);
	return rows.map((row) => ({
		lineId: row.lineId,
		customerOrganizationId: row.customerOrganizationId,
		hostOrganizationId: row.hostOrganizationId,
		grossMicroUsd: MicroUsd.parse(row.grossMicroUsd),
		hostMicroUsd: MicroUsd.parse(row.hostMicroUsd),
		markupMicroUsd: MicroUsd.parse(row.markupMicroUsd),
	}));
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

export function findMachinesDueForBenchmark(
	manager: EntityManager,
	reissueAfter: Date,
	limit: number
): Promise<BenchmarkDueRow[]> {
	return manager.execute<BenchmarkDueRow[]>(
		`SELECT machine.id AS "machineId",
		        CASE WHEN machine."latestBenchmarkId" IS NULL THEN ? ELSE ? END AS "trigger"
		   FROM "machine" machine
		  WHERE machine.state = ?
		    AND machine."identityKeyId" IS NOT NULL
		    AND (
		      machine."latestBenchmarkId" IS NULL
		      OR (machine."inventoryDigest" IS NOT NULL
		          AND machine."inventoryDigest" IS DISTINCT FROM machine."benchmarkedInventoryDigest")
		    )
		    AND NOT EXISTS (
		      SELECT 1 FROM "sandbox_placement" placement
		       WHERE placement."machineId" = machine.id AND placement."releasedAt" IS NULL
		    )
		    AND NOT EXISTS (
		      SELECT 1 FROM "machine_benchmark" benchmark
		       WHERE benchmark."machineId" = machine.id
		         AND (benchmark.state = ?
		              OR (benchmark."issuedAt" > ?
		                  AND NOT (benchmark.state = ? AND machine."lastChecked" > benchmark."completedAt")))
		    )
		  ORDER BY machine.id
		  LIMIT ?`,
		[
			BenchmarkTrigger.REGISTRATION,
			BenchmarkTrigger.INVENTORY_CHANGE,
			MachineState.READY,
			BenchmarkState.PENDING,
			reissueAfter,
			BenchmarkState.NOT_ADMITTED,
			limit,
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
