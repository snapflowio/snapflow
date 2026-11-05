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
import { MILLISECONDS_PER_SECOND } from '../../common/constants/time.constants';
import { integrationDatabaseUrl } from '../../common/testing/integration-database.util';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { priceUsage } from '../../marketplace/utils/pricing.util';
import { quantitiesFor } from '../../usage/utils/usage-quantities.util';
import { BillingLedgerAccountCode } from '../constants/billing.constants';
import {
	WINDOW_ALLOCATION,
	WINDOW_TERMS,
} from '../testing/billable-window.fixtures';
import {
	insertLedgerAccounts,
	insertLedgerPosting,
	ledgerBalances,
} from '../testing/ledger-database.fixtures';
import { settleWindow } from '../testing/recording-ledger.fake';
import type { UsageAttestation } from '../utils/evidence/usage-attestation.util';

const DATABASE_URL = integrationDatabaseUrl();
const WINDOW_START = new Date('2026-10-04T12:00:00.000Z');
const WINDOW_MILLIS = 90 * MILLISECONDS_PER_SECOND;
const ATTESTED_THIRDS = 2n;
const THIRDS = 3n;

function twoThirdsAttested(gross: MicroUsd): UsageAttestation {
	const charged = priceUsage(
		WINDOW_TERMS,
		quantitiesFor(
			WINDOW_ALLOCATION,
			(BigInt(WINDOW_MILLIS) * ATTESTED_THIRDS) / THIRDS,
			0n
		)
	);
	return {
		computeMillis: 0n,
		storageMillis: 0n,
		receiptCount: 0,
		attestedQuantities: quantitiesFor(WINDOW_ALLOCATION, 0n, 0n),
		charged,
		creditMicroUsd: gross.subtract(charged.grossMicroUsd),
	};
}

describe('usage attestation ledger postings', {
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

	it('balance under the deferred ledger constraint and net to the attested charge', async () => {
		const settled = await settleWindow(
			WINDOW_START,
			WINDOW_MILLIS,
			twoThirdsAttested
		);
		await client.query('begin');
		try {
			const accounts = await insertLedgerAccounts(client, settled.postings);
			for (const posting of settled.postings) {
				await insertLedgerPosting(client, posting, accounts);
			}
			await client.query('set constraints all immediate');
			const byCode = await ledgerBalances(client, accounts);
			const charged = twoThirdsAttested(settled.gross).charged.grossMicroUsd;
			assert.deepEqual(
				byCode.get(BillingLedgerAccountCode.CUSTOMER_CREDIT),
				charged
			);
			assert.deepEqual(
				(
					byCode.get(BillingLedgerAccountCode.HOST_EARNINGS_PENDING) ??
					MicroUsd.ZERO
				).add(
					byCode.get(BillingLedgerAccountCode.PLATFORM_MARKUP_REVENUE) ??
						MicroUsd.ZERO
				),
				charged.negate()
			);
		} finally {
			await client.query('rollback');
		}
	});
});
