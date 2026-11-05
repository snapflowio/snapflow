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
import { integrationDatabaseUrl } from '../../common/testing/integration-database.util';
import { ENTITY_MAPPING_OPTIONS } from '../../infra/database/config/entity-mapping.config';
import type { UnratedEvidenceRow } from '../types/network-usage.types';
import { groupUnratedEvidence } from '../utils/network-usage-period.util';
import {
	ASSIGN_RECEIPTS_SQL,
	UNRATED_EVIDENCE_SQL,
} from './network-usage-rating.query';

const DATABASE_URL = integrationDatabaseUrl();
const BATCH = 100;
const SCHEMA_SQL = [
	`CREATE TABLE sandbox_lease (id uuid PRIMARY KEY, "placementId" uuid NOT NULL,
		"startedAt" timestamptz NOT NULL)`,
	`CREATE TABLE machine_usage_receipt (id uuid PRIMARY KEY, "placementId" uuid NOT NULL,
		"receivedAt" timestamptz NOT NULL, "networkPeriodId" uuid)`,
	`CREATE TABLE exposure_network_usage (id uuid PRIMARY KEY, "placementId" uuid NOT NULL,
		"createdAt" timestamptz NOT NULL, "periodId" uuid)`,
];

describe('network usage rating evidence selection', {
	skip: DATABASE_URL ? false : 'DATABASE_URL is not configured',
}, () => {
	const schema = `network_rating_${randomUUID().replaceAll('-', '')}`;
	let orm: MikroORM;

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
	});

	after(async () => {
		if (!orm) return;
		await orm.em.getConnection().execute(`DROP SCHEMA ${schema} CASCADE`);
		await orm.close(true);
	});

	it('buckets unrated evidence by arrival hour and the lease in force at arrival', async () => {
		const placement = randomUUID();
		const original = randomUUID();
		const renewed = randomUUID();
		await orm.em
			.getConnection()
			.execute('INSERT INTO sandbox_lease VALUES (?, ?, ?), (?, ?, ?)', [
				original,
				placement,
				'2026-10-18T08:00:00Z',
				renewed,
				placement,
				'2026-10-18T10:30:00Z',
			]);
		const receipt = async (
			receivedAt: string,
			periodId: string | null = null
		) => {
			const id = randomUUID();
			await orm.em
				.getConnection()
				.execute('INSERT INTO machine_usage_receipt VALUES (?, ?, ?, ?)', [
					id,
					placement,
					receivedAt,
					periodId,
				]);
			return id;
		};
		const edge = async (createdAt: string) => {
			const id = randomUUID();
			await orm.em
				.getConnection()
				.execute('INSERT INTO exposure_network_usage VALUES (?, ?, ?, null)', [
					id,
					placement,
					createdAt,
				]);
			return id;
		};
		const early = await receipt('2026-10-18T09:15:00Z');
		const beforeRenewal = await receipt('2026-10-18T10:10:00Z');
		const edgeBeforeRenewal = await edge('2026-10-18T10:20:00Z');
		const afterRenewal = await receipt('2026-10-18T10:45:00Z');
		await receipt('2026-10-18T09:30:00Z', randomUUID());
		await receipt('2026-10-18T11:01:00Z');

		const rows = await orm.em
			.getConnection()
			.execute<UnratedEvidenceRow[]>(UNRATED_EVIDENCE_SQL, [
				'2026-10-18T11:00:00Z',
				'2026-10-18T11:00:00Z',
				BATCH,
			]);
		const periods = groupUnratedEvidence(rows, BATCH).map((period) => ({
			leaseId: period.leaseId,
			periodStart: period.periodStart.toISOString(),
			receiptIds: period.receiptIds.sort(),
			edgeIds: period.edgeIds,
		}));
		assert.deepEqual(
			periods.sort((left, right) =>
				`${left.periodStart}${left.leaseId}`.localeCompare(
					`${right.periodStart}${right.leaseId}`
				)
			),
			[
				{
					leaseId: original,
					periodStart: '2026-10-18T09:00:00.000Z',
					receiptIds: [early],
					edgeIds: [],
				},
				...[
					{
						leaseId: original,
						periodStart: '2026-10-18T10:00:00.000Z',
						receiptIds: [beforeRenewal],
						edgeIds: [edgeBeforeRenewal],
					},
					{
						leaseId: renewed,
						periodStart: '2026-10-18T10:00:00.000Z',
						receiptIds: [afterRenewal],
						edgeIds: [],
					},
				].sort((left, right) => left.leaseId.localeCompare(right.leaseId)),
			]
		);
	});

	it('assigns evidence id lists of any length to a period', async () => {
		const connection = orm.em.getConnection();
		const placement = randomUUID();
		const ids = [randomUUID(), randomUUID()];
		for (const id of ids) {
			await connection.execute(
				'INSERT INTO machine_usage_receipt VALUES (?, ?, ?, null)',
				[id, placement, '2026-10-18T12:05:00Z']
			);
		}
		const period = randomUUID();
		await connection.execute(ASSIGN_RECEIPTS_SQL, [period, []]);
		await connection.execute(ASSIGN_RECEIPTS_SQL, [period, ids]);
		const assigned = await connection.execute<{ id: string }[]>(
			'SELECT id FROM machine_usage_receipt WHERE "networkPeriodId" = ? ORDER BY id',
			[period]
		);
		assert.deepEqual(
			assigned.map(({ id }) => id),
			[...ids].sort()
		);
	});
});
