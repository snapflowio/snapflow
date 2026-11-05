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
import { MikroORM } from '@mikro-orm/postgresql';
import {
	BILLING_LEDGER_CURRENCY,
	BillingEvidenceStatus,
	BillingLedgerAccountCode,
	BillingLedgerOwnerKind,
	BillingLedgerSide,
	BillingLedgerSourceType,
} from '../../billing/constants/billing.constants';
import { MILLISECONDS_PER_DAY } from '../../common/constants/time.constants';
import { integrationDatabaseUrl } from '../../common/testing/integration-database.util';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { ENTITY_MAPPING_OPTIONS } from '../../infra/database/config/entity-mapping.config';
import { VerificationReviewState } from '../../verification/enums/verification-review-state.enum';
import { lockReleasableLine, maturityCandidates } from './host-earnings.query';

const DATABASE_URL = integrationDatabaseUrl();
const HOST_MICRO_USD = 1_000n;
const CANDIDATE_LIMIT = 10;
const RECONCILED_DAYS_AGO = 20;

const SCHEMA_SQL = [
	`CREATE TABLE billing_line_item (id uuid PRIMARY KEY, "machineId" uuid NOT NULL,
		"hostOrganizationId" uuid, "customerOrganizationId" uuid NOT NULL,
		"hostMicroUsd" numeric NOT NULL, "evidenceStatus" varchar NOT NULL,
		"reconciledAt" timestamptz, "earningsReleasedAt" timestamptz)`,
	`CREATE TABLE billing_ledger_account (id uuid PRIMARY KEY, "ownerKind" varchar NOT NULL,
		"ownerReference" varchar NOT NULL, "accountCode" varchar NOT NULL, currency varchar NOT NULL)`,
	`CREATE TABLE billing_ledger_transaction (id uuid PRIMARY KEY,
		"sourceType" varchar NOT NULL, "sourceReference" varchar NOT NULL)`,
	`CREATE TABLE billing_ledger_entry (id uuid PRIMARY KEY,
		"transactionId" uuid NOT NULL REFERENCES billing_ledger_transaction (id),
		"accountId" uuid NOT NULL REFERENCES billing_ledger_account (id),
		side varchar NOT NULL, amount numeric NOT NULL)`,
	`CREATE TABLE verification_review (id uuid PRIMARY KEY, "machineId" uuid NOT NULL, state varchar NOT NULL)`,
	`CREATE TABLE machine (id uuid PRIMARY KEY, "restrictedAt" timestamptz)`,
];

describe('host earnings releasability', {
	skip: DATABASE_URL ? false : 'DATABASE_URL is not configured',
}, () => {
	const schema = `host_earnings_${randomUUID().replaceAll('-', '')}`;
	const hostOrganizationId = randomUUID();
	let orm: MikroORM;
	let pendingAccountId: string;

	before(async () => {
		orm = await MikroORM.init({
			...ENTITY_MAPPING_OPTIONS,
			clientUrl: DATABASE_URL,
			entities: [],
			discovery: { warnWhenNoEntities: false },
			driverOptions: { options: `-c search_path=${schema}` },
		});
		const connection = orm.em.getConnection();
		await connection.execute(`CREATE SCHEMA ${schema}`);
		for (const statement of SCHEMA_SQL) await connection.execute(statement);
		pendingAccountId = randomUUID();
		await connection.execute(
			`INSERT INTO billing_ledger_account (id, "ownerKind", "ownerReference", "accountCode", currency)
			 VALUES (?, ?, ?, ?, ?)`,
			[
				pendingAccountId,
				BillingLedgerOwnerKind.ORGANIZATION,
				hostOrganizationId,
				BillingLedgerAccountCode.HOST_EARNINGS_PENDING,
				BILLING_LEDGER_CURRENCY,
			]
		);
	});

	after(async () => {
		if (!orm) return;
		await orm.em.getConnection().execute(`DROP SCHEMA ${schema} CASCADE`);
		await orm.close(true);
	});

	async function line(): Promise<{ lineId: string; machineId: string }> {
		const lineId = randomUUID();
		const machineId = randomUUID();
		const connection = orm.em.getConnection();
		await connection.execute(
			`INSERT INTO billing_line_item (id, "machineId", "hostOrganizationId", "customerOrganizationId",
				"hostMicroUsd", "evidenceStatus", "reconciledAt")
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[
				lineId,
				machineId,
				hostOrganizationId,
				randomUUID(),
				HOST_MICRO_USD.toString(),
				BillingEvidenceStatus.CORROBORATED,
				new Date(Date.now() - RECONCILED_DAYS_AGO * MILLISECONDS_PER_DAY),
			]
		);
		await connection.execute('INSERT INTO machine (id) VALUES (?)', [
			machineId,
		]);
		await post(
			lineId,
			BillingLedgerSourceType.LINE_USAGE,
			BillingLedgerSide.CREDIT
		);
		return { lineId, machineId };
	}

	async function post(
		lineId: string,
		sourceType: string,
		side: string
	): Promise<void> {
		const transactionId = randomUUID();
		const connection = orm.em.getConnection();
		await connection.execute(
			`INSERT INTO billing_ledger_transaction (id, "sourceType", "sourceReference") VALUES (?, ?, ?)`,
			[transactionId, sourceType, lineId]
		);
		await connection.execute(
			`INSERT INTO billing_ledger_entry (id, "transactionId", "accountId", side, amount)
			 VALUES (?, ?, ?, ?, ?)`,
			[
				randomUUID(),
				transactionId,
				pendingAccountId,
				side,
				HOST_MICRO_USD.toString(),
			]
		);
	}

	async function releasable(lineId: string): Promise<{
		candidate: boolean;
		pending: MicroUsd | null;
	}> {
		const candidates = await maturityCandidates(
			orm.em.fork(),
			new Date(),
			null,
			CANDIDATE_LIMIT
		);
		const pending = await orm.em
			.fork()
			.transactional((manager) => lockReleasableLine(manager, lineId));
		return {
			candidate: candidates.some((candidate) => candidate.lineId === lineId),
			pending,
		};
	}

	it('releases the pending earnings of a corroborated line', async () => {
		const { lineId } = await line();
		assert.deepEqual(await releasable(lineId), {
			candidate: true,
			pending: MicroUsd.of(HOST_MICRO_USD),
		});
	});

	it('skips a line whose earnings were forfeited', async () => {
		const { lineId } = await line();
		await post(
			lineId,
			BillingLedgerSourceType.EARNINGS_FORFEITURE,
			BillingLedgerSide.DEBIT
		);
		assert.deepEqual(await releasable(lineId), {
			candidate: false,
			pending: null,
		});
	});

	it('skips a line while its machine has an open review', async () => {
		const { lineId, machineId } = await line();
		await orm.em
			.getConnection()
			.execute(
				'INSERT INTO verification_review (id, "machineId", state) VALUES (?, ?, ?)',
				[randomUUID(), machineId, VerificationReviewState.OPEN]
			);
		assert.deepEqual(await releasable(lineId), {
			candidate: false,
			pending: null,
		});
	});

	it('skips a line of a restricted machine', async () => {
		const { lineId, machineId } = await line();
		await orm.em
			.getConnection()
			.execute('UPDATE machine SET "restrictedAt" = now() WHERE id = ?', [
				machineId,
			]);
		assert.deepEqual(await releasable(lineId), {
			candidate: false,
			pending: null,
		});
	});

	it('skips a line that is not corroborated', async () => {
		const { lineId } = await line();
		await orm.em
			.getConnection()
			.execute(
				'UPDATE billing_line_item SET "evidenceStatus" = ? WHERE id = ?',
				[BillingEvidenceStatus.PENDING, lineId]
			);
		assert.deepEqual(await releasable(lineId), {
			candidate: false,
			pending: null,
		});
	});
});
