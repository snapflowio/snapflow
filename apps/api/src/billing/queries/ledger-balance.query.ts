/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { MicroUsd } from '../../common/values/micro-usd.value';
import {
	BILLING_LEDGER_CURRENCY,
	BILLING_LEDGER_NORMAL_SIDE,
	BillingLedgerAccountCode,
	BillingLedgerOwnerKind,
} from '../constants/billing.constants';

const SIGNED_AMOUNT_SQL =
	'CASE WHEN entry.side = ? THEN entry.amount ELSE -entry.amount END';

export async function customerCreditBalances(
	manager: EntityManager,
	organizationIds: readonly string[]
): Promise<Map<string, MicroUsd>> {
	const balances = new Map(
		organizationIds.map((organizationId) => [organizationId, MicroUsd.ZERO])
	);
	if (organizationIds.length === 0) return balances;
	const rows = await manager.execute<
		{ organizationId: string; balance: string }[]
	>(
		`SELECT account."ownerReference" AS "organizationId",
				COALESCE(SUM(${SIGNED_AMOUNT_SQL}), 0) AS balance
		 FROM "billing_ledger_entry" entry
		 INNER JOIN "billing_ledger_account" account ON account.id = entry."accountId"
		 WHERE account."ownerKind" = ?
		   AND account."ownerReference" IN (?)
		   AND account."accountCode" = ?
		   AND account.currency = ?
		 GROUP BY account."ownerReference"`,
		[
			BILLING_LEDGER_NORMAL_SIDE[BillingLedgerAccountCode.CUSTOMER_CREDIT],
			BillingLedgerOwnerKind.ORGANIZATION,
			organizationIds,
			BillingLedgerAccountCode.CUSTOMER_CREDIT,
			BILLING_LEDGER_CURRENCY,
		]
	);
	for (const row of rows) {
		balances.set(row.organizationId, MicroUsd.parse(row.balance));
	}
	return balances;
}
