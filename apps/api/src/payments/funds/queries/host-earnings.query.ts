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
	BILLING_LEDGER_CURRENCY,
	BillingEvidenceStatus,
	BillingLedgerAccountCode,
	BillingLedgerOwnerKind,
	BillingLedgerSide,
	BillingLedgerSourceType,
} from '../../../billing/ledger/constants/billing.constants';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import { parseDatabaseTimestamp } from '../../../infra/database/utils/database-time.util';
import { VerificationReviewState } from '../../../verification/qualification/enums/verification-review-state.enum';

export interface MaturityCandidate {
	lineId: string;
	hostOrganizationId: string;
	customerOrganizationId: string;
	machineId: string;
	reconciledAt: Date;
}

export interface MaturityCursor {
	reconciledAt: Date;
	lineId: string;
}

export interface UnreleasedEarnings {
	machineId: string;
	customerOrganizationId: string;
	reconciledAt: Date;
	pendingMicroUsd: MicroUsd;
}

const LINE_PENDING_EARNINGS_SQL = `COALESCE((
	SELECT SUM(CASE WHEN entry.side = ? THEN entry.amount ELSE -entry.amount END)
	FROM "billing_ledger_entry" entry
	INNER JOIN "billing_ledger_account" account ON account.id = entry."accountId"
	INNER JOIN "billing_ledger_transaction" ledger_transaction
		ON ledger_transaction.id = entry."transactionId"
	WHERE account."ownerKind" = ?
	  AND account."ownerReference" = line."hostOrganizationId"::text
	  AND account."accountCode" = ?
	  AND account.currency = ?
	  AND ledger_transaction."sourceReference" = line.id::text
	  AND ledger_transaction."sourceType" IN (?)
), 0)`;

const RELEASABLE_LINE_SQL = `line."earningsReleasedAt" IS NULL
	AND line."hostMicroUsd" > 0
	AND line."hostOrganizationId" IS NOT NULL
	AND line."evidenceStatus" = ?
	AND line."reconciledAt" IS NOT NULL
	AND NOT EXISTS (
		SELECT 1 FROM "billing_ledger_transaction" forfeiture
		WHERE forfeiture."sourceType" = ?
		  AND forfeiture."sourceReference" = line.id::text
	)`;

const UNFROZEN_LINE_SQL = `NOT EXISTS (
	SELECT 1 FROM "verification_review" review
	WHERE review."machineId" = line."machineId" AND review.state = ?
)
	AND NOT EXISTS (
		SELECT 1 FROM "machine" machine
		WHERE machine.id = line."machineId"
		  AND machine."restrictedAt" IS NOT NULL
	)`;

function releasableLineBindings(): unknown[] {
	return [
		BillingEvidenceStatus.CORROBORATED,
		BillingLedgerSourceType.EARNINGS_FORFEITURE,
	];
}

const LINE_EARNINGS_SOURCES = [
	BillingLedgerSourceType.LINE_USAGE,
	BillingLedgerSourceType.EARNINGS_FORFEITURE,
	BillingLedgerSourceType.EARNINGS_MATURITY,
];

function linePendingBindings(): unknown[] {
	return [
		BillingLedgerSide.CREDIT,
		BillingLedgerOwnerKind.ORGANIZATION,
		BillingLedgerAccountCode.HOST_EARNINGS_PENDING,
		BILLING_LEDGER_CURRENCY,
		LINE_EARNINGS_SOURCES,
	];
}

export async function maturityCandidates(
	manager: EntityManager,
	reconciledBefore: Date,
	after: MaturityCursor | null,
	limit: number
): Promise<MaturityCandidate[]> {
	const rows = await manager.execute<
		{
			lineId: string;
			hostOrganizationId: string;
			customerOrganizationId: string;
			machineId: string;
			reconciledAt: unknown;
		}[]
	>(
		`SELECT line.id AS "lineId",
				line."hostOrganizationId",
				line."customerOrganizationId",
				line."machineId",
				line."reconciledAt"
		 FROM "billing_line_item" line
		 WHERE ${RELEASABLE_LINE_SQL}
		   AND line."reconciledAt" <= ?
		   AND ${UNFROZEN_LINE_SQL}
		   AND (?::timestamptz IS NULL OR (line."reconciledAt", line.id) > (?::timestamptz, ?::uuid))
		 ORDER BY line."reconciledAt" ASC, line.id ASC
		 LIMIT ?`,
		[
			...releasableLineBindings(),
			reconciledBefore,
			VerificationReviewState.OPEN,
			after?.reconciledAt ?? null,
			after?.reconciledAt ?? null,
			after?.lineId ?? null,
			limit,
		]
	);
	return rows.map((row) => ({
		lineId: row.lineId,
		hostOrganizationId: row.hostOrganizationId,
		customerOrganizationId: row.customerOrganizationId,
		machineId: row.machineId,
		reconciledAt: parseDatabaseTimestamp(row.reconciledAt),
	}));
}

export async function lockReleasableLine(
	manager: EntityManager,
	lineId: string
): Promise<MicroUsd | null> {
	await manager.execute(
		'SELECT id FROM "billing_line_item" WHERE id = ? FOR UPDATE',
		[lineId]
	);
	const [row] = await manager.execute<{ pending: string }[]>(
		`SELECT ${LINE_PENDING_EARNINGS_SQL} AS pending
		 FROM "billing_line_item" line
		 WHERE line.id = ?
		   AND ${RELEASABLE_LINE_SQL}
		   AND ${UNFROZEN_LINE_SQL}`,
		[
			...linePendingBindings(),
			lineId,
			...releasableLineBindings(),
			VerificationReviewState.OPEN,
		]
	);
	return row ? MicroUsd.parse(row.pending) : null;
}

export async function markEarningsReleased(
	manager: EntityManager,
	lineId: string
): Promise<void> {
	await manager.execute(
		`UPDATE "billing_line_item"
		 SET "earningsReleasedAt" = transaction_timestamp()
		 WHERE id = ? AND "earningsReleasedAt" IS NULL`,
		[lineId]
	);
}

export async function unreleasedEarnings(
	manager: EntityManager,
	hostOrganizationId: string
): Promise<UnreleasedEarnings[]> {
	const rows = await manager.execute<
		{
			machineId: string;
			customerOrganizationId: string;
			reconciledAt: unknown;
			pending: string;
		}[]
	>(
		`SELECT line."machineId",
				line."customerOrganizationId",
				MAX(line."reconciledAt") AS "reconciledAt",
				SUM(${LINE_PENDING_EARNINGS_SQL}) AS pending
		 FROM "billing_line_item" line
		 WHERE ${RELEASABLE_LINE_SQL}
		   AND line."hostOrganizationId" = ?
		 GROUP BY line."machineId", line."customerOrganizationId",
				date_trunc('day', line."reconciledAt")`,
		[...linePendingBindings(), ...releasableLineBindings(), hostOrganizationId]
	);
	return rows
		.map((row) => ({
			machineId: row.machineId,
			customerOrganizationId: row.customerOrganizationId,
			reconciledAt: parseDatabaseTimestamp(row.reconciledAt),
			pendingMicroUsd: MicroUsd.parse(row.pending),
		}))
		.filter((row) => row.pendingMicroUsd.isPositive());
}
