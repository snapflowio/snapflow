/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { Client } from 'pg';
import { integrationDatabaseUrl } from '../../../common/testing/integration-database.util';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import { ratedNetworkPeriod } from '../../../networking/usage/testing/network-period.fixtures';
import { BillingLedgerAccountCode } from '../../constants/billing.constants';
import {
	insertLedgerAccounts,
	insertLedgerPosting,
	ledgerBalances,
} from '../../testing/ledger-database.fixtures';
import { usagePosting } from './billing-usage-posting.util';

const DATABASE_URL = integrationDatabaseUrl();

describe('network usage ledger postings', {
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

	it('debits the customer and splits the egress charge between host earnings and markup', async () => {
		const { line, period } = ratedNetworkPeriod();
		const posting = usagePosting(line, {
			hostMicroUsd: MicroUsd.parse(period.hostMicroUsd),
			markupMicroUsd: MicroUsd.parse(period.markupMicroUsd),
			grossMicroUsd: MicroUsd.parse(period.grossMicroUsd),
		});
		await client.query('begin');
		try {
			const accounts = await insertLedgerAccounts(client, [posting]);
			await insertLedgerPosting(client, posting, accounts);
			await client.query('set constraints all immediate');
			const balances = await ledgerBalances(client, accounts);
			assert.deepEqual(
				balances.get(BillingLedgerAccountCode.CUSTOMER_CREDIT),
				MicroUsd.parse(period.grossMicroUsd)
			);
			assert.deepEqual(
				balances.get(BillingLedgerAccountCode.HOST_EARNINGS_PENDING),
				MicroUsd.parse(period.hostMicroUsd).negate()
			);
			assert.deepEqual(
				balances.get(BillingLedgerAccountCode.PLATFORM_MARKUP_REVENUE),
				MicroUsd.parse(period.markupMicroUsd).negate()
			);
		} finally {
			await client.query('rollback');
		}
	});
});
