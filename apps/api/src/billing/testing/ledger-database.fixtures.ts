/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { SHA256_HEX_LENGTH } from '../../common/constants/digest.constants';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { BILLING_LEDGER_CURRENCY } from '../constants/billing.constants';
import type { BillingLedgerPosting } from '../services/billing-ledger.service';

const POSTING_HASH = '0'.repeat(SHA256_HEX_LENGTH);

export async function insertLedgerAccounts(
	client: Client,
	postings: readonly BillingLedgerPosting[]
): Promise<Map<string, string>> {
	const accounts = new Map<string, string>();
	const ownerReference = randomUUID();
	for (const posting of postings) {
		for (const entry of posting.entries) {
			const code = entry.account.accountCode;
			if (accounts.has(code)) continue;
			const id = randomUUID();
			await client.query(
				`insert into "billing_ledger_account"
					(id, "ownerKind", "ownerReference", "accountCode", currency)
				 values ($1, $2, $3, $4, $5)`,
				[
					id,
					entry.account.ownerKind,
					ownerReference,
					code,
					BILLING_LEDGER_CURRENCY,
				]
			);
			accounts.set(code, id);
		}
	}
	return accounts;
}

export async function insertLedgerPosting(
	client: Client,
	posting: BillingLedgerPosting,
	accounts: ReadonlyMap<string, string>
): Promise<void> {
	const transactionId = randomUUID();
	await client.query(
		`insert into "billing_ledger_transaction"
			(id, "sourceType", "sourceReference", "sourceVersion", "postingHash", "descriptionCode", "effectiveAt", "postedAt")
		 values ($1, $2, $3, $4, $5, $6, $7, transaction_timestamp())`,
		[
			transactionId,
			posting.sourceType,
			randomUUID(),
			posting.sourceVersion,
			POSTING_HASH,
			posting.descriptionCode,
			posting.effectiveAt,
		]
	);
	for (const [entryNumber, entry] of posting.entries.entries()) {
		await client.query(
			`insert into "billing_ledger_entry"
				(id, "transactionId", "entryNumber", "accountId", side, amount)
			 values ($1, $2, $3, $4, $5, $6)`,
			[
				randomUUID(),
				transactionId,
				entryNumber,
				accounts.get(entry.account.accountCode),
				entry.side,
				entry.amount,
			]
		);
	}
}

export async function ledgerBalances(
	client: Client,
	accounts: ReadonlyMap<string, string>
): Promise<Map<string, MicroUsd>> {
	const balances = await client.query<{
		accountCode: string;
		balance: string;
	}>(
		`select account."accountCode",
			sum(case when entry.side = 'debit' then entry.amount else -entry.amount end)::text as balance
		 from "billing_ledger_entry" entry
		 join "billing_ledger_account" account on account.id = entry."accountId"
		 where account.id = any($1::uuid[])
		 group by account."accountCode"`,
		[[...accounts.values()]]
	);
	return new Map(
		balances.rows.map((row) => [row.accountCode, MicroUsd.parse(row.balance)])
	);
}
