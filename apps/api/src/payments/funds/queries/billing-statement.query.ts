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
	BillingLedgerAccountCode,
	BillingLedgerOwnerKind,
	BillingLedgerSide,
	BillingLedgerSourceType,
} from '../../../billing/ledger/constants/billing.constants';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import { parseDatabaseTimestamp } from '../../../infra/database/utils/database-time.util';
import { SOFT_DELETED_SANDBOX_NAME_PREFIX } from '../../../sandbox/instance/constants/sandbox.constants';

export interface StatementTotalRow {
	accountCode: string;
	sourceType: string;
	amountMicroUsd: MicroUsd;
}

export interface StatementSandboxUsageRow {
	sandboxId: string;
	sandboxName: string | null;
	amountMicroUsd: MicroUsd;
}

const SIDE_SIGNED_AMOUNT_SQL =
	'CASE WHEN entry.side = ? THEN entry.amount ELSE -entry.amount END';

const ORGANIZATION_ACCOUNTS_SQL = `account."ownerKind" = ?
	AND account."ownerReference" = ?
	AND account.currency = ?`;

function organizationBindings(organizationId: string): unknown[] {
	return [
		BillingLedgerOwnerKind.ORGANIZATION,
		organizationId,
		BILLING_LEDGER_CURRENCY,
	];
}

export async function statementTotals(
	manager: EntityManager,
	organizationId: string,
	periodStart: Date,
	periodEnd: Date
): Promise<StatementTotalRow[]> {
	const rows = await manager.execute<
		{ accountCode: string; sourceType: string; amount: string }[]
	>(
		`SELECT account."accountCode",
				ledger_transaction."sourceType",
				COALESCE(SUM(${SIDE_SIGNED_AMOUNT_SQL}), 0) AS amount
		 FROM "billing_ledger_entry" entry
		 INNER JOIN "billing_ledger_account" account ON account.id = entry."accountId"
		 INNER JOIN "billing_ledger_transaction" ledger_transaction
			ON ledger_transaction.id = entry."transactionId"
		 WHERE ${ORGANIZATION_ACCOUNTS_SQL}
		   AND ledger_transaction."effectiveAt" >= ?
		   AND ledger_transaction."effectiveAt" < ?
		 GROUP BY account."accountCode", ledger_transaction."sourceType"`,
		[
			BillingLedgerSide.CREDIT,
			...organizationBindings(organizationId),
			periodStart,
			periodEnd,
		]
	);
	return rows.map((row) => ({
		accountCode: row.accountCode,
		sourceType: row.sourceType,
		amountMicroUsd: MicroUsd.parse(row.amount),
	}));
}

export async function customerCreditBefore(
	manager: EntityManager,
	organizationId: string,
	instant: Date
): Promise<MicroUsd> {
	const [row] = await manager.execute<{ balance: string }[]>(
		`SELECT COALESCE(SUM(${SIDE_SIGNED_AMOUNT_SQL}), 0) AS balance
		 FROM "billing_ledger_entry" entry
		 INNER JOIN "billing_ledger_account" account ON account.id = entry."accountId"
		 INNER JOIN "billing_ledger_transaction" ledger_transaction
			ON ledger_transaction.id = entry."transactionId"
		 WHERE ${ORGANIZATION_ACCOUNTS_SQL}
		   AND account."accountCode" = ?
		   AND ledger_transaction."effectiveAt" < ?`,
		[
			BillingLedgerSide.CREDIT,
			...organizationBindings(organizationId),
			BillingLedgerAccountCode.CUSTOMER_CREDIT,
			instant,
		]
	);
	return row ? MicroUsd.parse(row.balance) : MicroUsd.ZERO;
}

export async function statementUsageBySandbox(
	manager: EntityManager,
	organizationId: string,
	periodStart: Date,
	periodEnd: Date
): Promise<StatementSandboxUsageRow[]> {
	const rows = await manager.execute<
		{ sandboxId: string; sandboxName: string | null; amount: string }[]
	>(
		`SELECT ledger_transaction.metadata->>'sandboxId' AS "sandboxId",
				sandbox.name AS "sandboxName",
				SUM(${SIDE_SIGNED_AMOUNT_SQL}) AS amount
		 FROM "billing_ledger_entry" entry
		 INNER JOIN "billing_ledger_account" account ON account.id = entry."accountId"
		 INNER JOIN "billing_ledger_transaction" ledger_transaction
			ON ledger_transaction.id = entry."transactionId"
		 LEFT JOIN "sandbox" sandbox
			ON sandbox.id::text = ledger_transaction.metadata->>'sandboxId'
		   AND sandbox."organizationId"::text = account."ownerReference"
		   AND NOT starts_with(sandbox.name, ?)
		 WHERE ${ORGANIZATION_ACCOUNTS_SQL}
		   AND account."accountCode" = ?
		   AND ledger_transaction."sourceType" = ?
		   AND ledger_transaction.metadata->>'sandboxId' IS NOT NULL
		   AND ledger_transaction."effectiveAt" >= ?
		   AND ledger_transaction."effectiveAt" < ?
		 GROUP BY ledger_transaction.metadata->>'sandboxId', sandbox.name
		 ORDER BY amount DESC, "sandboxId" ASC`,
		[
			BillingLedgerSide.DEBIT,
			SOFT_DELETED_SANDBOX_NAME_PREFIX,
			...organizationBindings(organizationId),
			BillingLedgerAccountCode.CUSTOMER_CREDIT,
			BillingLedgerSourceType.LINE_USAGE,
			periodStart,
			periodEnd,
		]
	);
	return rows.map((row) => ({
		sandboxId: row.sandboxId,
		sandboxName: row.sandboxName,
		amountMicroUsd: MicroUsd.parse(row.amount),
	}));
}

export async function statementTax(
	manager: EntityManager,
	organizationId: string,
	periodStart: Date,
	periodEnd: Date
): Promise<MicroUsd> {
	const [row] = await manager.execute<{ total: string }[]>(
		`SELECT COALESCE(SUM((ledger_transaction.metadata->>'taxMicroUsd')::numeric), 0) AS total
		 FROM "billing_ledger_transaction" ledger_transaction
		 WHERE ledger_transaction."sourceType" = ?
		   AND ledger_transaction.metadata->>'organizationId' = ?
		   AND ledger_transaction."effectiveAt" >= ?
		   AND ledger_transaction."effectiveAt" < ?`,
		[
			BillingLedgerSourceType.STRIPE_TOP_UP,
			organizationId,
			periodStart,
			periodEnd,
		]
	);
	return row ? MicroUsd.parse(row.total) : MicroUsd.ZERO;
}

export async function firstLedgerActivity(
	manager: EntityManager,
	organizationId: string
): Promise<Date | null> {
	const [row] = await manager.execute<{ first: unknown }[]>(
		`SELECT MIN(ledger_transaction."effectiveAt") AS first
		 FROM "billing_ledger_entry" entry
		 INNER JOIN "billing_ledger_account" account ON account.id = entry."accountId"
		 INNER JOIN "billing_ledger_transaction" ledger_transaction
			ON ledger_transaction.id = entry."transactionId"
		 WHERE ${ORGANIZATION_ACCOUNTS_SQL}`,
		organizationBindings(organizationId)
	);
	return row?.first ? parseDatabaseTimestamp(row.first) : null;
}
