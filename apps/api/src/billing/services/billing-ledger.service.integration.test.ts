/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { Client } from 'pg';
import { integrationDatabaseUrl } from '../../common/testing/integration-database.util';
import {
	BILLING_LEDGER_CURRENCY,
	BillingLedgerAccountCode,
	BillingLedgerOwnerKind,
} from '../constants/billing.constants';

const DATABASE_URL = integrationDatabaseUrl();

describe('billing ledger database invariants', {
	skip: DATABASE_URL ? false : 'DATABASE_URL is not configured',
}, () => {
	let client: Client;

	before(async () => {
		client = new Client({ connectionString: DATABASE_URL });
		await client.connect();
	});

	after(async () => {
		if (client) await client.end();
	});

	it('accepts balanced postings and rejects later mutation', async () => {
		await client.query('begin');
		try {
			const { accountId, transactionId } = await insertPosting(client, true);
			await client.query('set constraints all immediate');
			await assert.rejects(
				client.query(
					'update "billing_ledger_entry" set amount = amount + 1 where "transactionId" = $1',
					[transactionId]
				),
				/Posted billing ledger records are immutable/
			);
			assert.ok(accountId);
		} finally {
			await client.query('rollback');
		}
	});

	it('rejects an account code outside the chart of accounts', async () => {
		await client.query('begin');
		try {
			await assert.rejects(
				client.query(
					`insert into "billing_ledger_account"
						(id, "ownerKind", "ownerReference", "accountCode", currency)
					 values ($1, $2, $3, 'unknown_account', $4)`,
					[
						randomUUID(),
						BillingLedgerOwnerKind.PLATFORM,
						randomUUID(),
						BILLING_LEDGER_CURRENCY,
					]
				),
				/CHK_billing_ledger_account_code/
			);
		} finally {
			await client.query('rollback');
		}
	});

	it('rejects an unbalanced posting at the transaction boundary', async () => {
		await client.query('begin');
		try {
			await insertPosting(client, false);
			await assert.rejects(
				client.query('set constraints all immediate'),
				/incomplete or unbalanced/
			);
		} finally {
			await client.query('rollback');
		}
	});
});

async function insertPosting(
	client: Client,
	balanced: boolean
): Promise<{ accountId: string; transactionId: string }> {
	const accountId = randomUUID();
	const balancingAccountId = randomUUID();
	const transactionId = randomUUID();
	await client.query(
		`insert into "billing_ledger_account"
			(id, "ownerKind", "ownerReference", "accountCode", currency)
		 values ($1, $4, $2, $5, $7),
			($3, $6, $2, $8, $7)`,
		[
			accountId,
			randomUUID(),
			balancingAccountId,
			BillingLedgerOwnerKind.PLATFORM,
			BillingLedgerAccountCode.ADMIN_CREDIT_GRANTS,
			BillingLedgerOwnerKind.ORGANIZATION,
			BILLING_LEDGER_CURRENCY,
			BillingLedgerAccountCode.CUSTOMER_CREDIT,
		]
	);
	await client.query(
		`insert into "billing_ledger_transaction"
			(id, "sourceType", "sourceReference", "sourceVersion", "postingHash", "descriptionCode", "effectiveAt", "postedAt")
		 values ($1, 'integration_test', $2, 1, $3, 'ledger_invariant_test', transaction_timestamp(), transaction_timestamp())`,
		[transactionId, randomUUID(), '0'.repeat(64)]
	);
	await client.query(
		`insert into "billing_ledger_entry"
			(id, "transactionId", "entryNumber", "accountId", side, amount)
		 values ($1, $2, 0, $3, 'debit', 100),
			($4, $2, 1, $5, 'credit', $6)`,
		[
			randomUUID(),
			transactionId,
			accountId,
			randomUUID(),
			balancingAccountId,
			balanced ? 100 : 99,
		]
	);
	return { accountId, transactionId };
}
