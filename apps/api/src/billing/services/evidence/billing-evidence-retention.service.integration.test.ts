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
import { MILLISECONDS_PER_DAY } from '../../../common/constants/time.constants';
import { integrationDatabaseUrl } from '../../../common/testing/integration-database.util';
import { ENTITY_MAPPING_OPTIONS } from '../../../infra/database/config/entity-mapping.config';
import { MachineUsageReceipt } from '../../../machine/entities/machine-usage-receipt.entity';
import { ExposureNetworkUsage } from '../../../network-usage/entities/exposure-network-usage.entity';
import { EdgeUsageCheckpoint } from '../../../networking/entities/edge-usage-checkpoint.entity';
import {
	BILLING_EVIDENCE_RETENTION,
	BillingEvidenceStatus,
	BillingLineSourceType,
} from '../../constants/billing.constants';
import { BillingEvidenceBundle } from '../../entities/billing-evidence-bundle.entity';
import { BillingEvidenceRetentionService } from './billing-evidence-retention.service';

const DATABASE_URL = integrationDatabaseUrl();
const AGE = { expired: 100, older: 120, recent: 10 } as const;
const LONG_CHAIN_RECEIPTS = BILLING_EVIDENCE_RETENTION.batchSize * 2 + 1;
const KEPT_CHAIN_RECEIPTS = 2;

const SCHEMA_SQL = [
	`CREATE TABLE billing_line_item (id uuid PRIMARY KEY, "placementId" uuid NOT NULL,
		"sourceType" varchar NOT NULL, "sourceId" uuid NOT NULL,
		"evidenceStatus" varchar NOT NULL, "reconciledAt" timestamptz)`,
	`CREATE TABLE billing_line_quarantine ("lineItemId" uuid PRIMARY KEY REFERENCES billing_line_item (id))`,
	`CREATE TABLE billing_evidence_bundle (id uuid PRIMARY KEY,
		"lineItemId" uuid NOT NULL REFERENCES billing_line_item (id), "createdAt" timestamptz NOT NULL)`,
	`CREATE TABLE sandbox_placement (id uuid PRIMARY KEY, "releasedAt" timestamptz)`,
	`CREATE TABLE machine_usage_receipt (id uuid PRIMARY KEY,
		"placementId" uuid NOT NULL REFERENCES sandbox_placement (id),
		"predecessorId" uuid REFERENCES machine_usage_receipt (id) ON DELETE RESTRICT,
		"sampledAt" timestamptz NOT NULL)`,
	`CREATE TABLE edge_usage_checkpoint (id uuid PRIMARY KEY, "edgeId" uuid NOT NULL,
		"usageEpoch" integer NOT NULL, sequence bigint NOT NULL,
		"intervalEndedAt" timestamptz NOT NULL)`,
	`CREATE TABLE exposure_network_usage (id uuid PRIMARY KEY,
		"edgeCheckpointId" uuid NOT NULL REFERENCES edge_usage_checkpoint (id) ON DELETE RESTRICT,
		"periodId" uuid, "createdAt" timestamptz NOT NULL)`,
];

const daysAgo = (days: number) =>
	new Date(Date.now() - days * MILLISECONDS_PER_DAY);

describe('billing evidence retention', {
	skip: DATABASE_URL ? false : 'DATABASE_URL is not configured',
}, () => {
	const schema = `evidence_retention_${randomUUID().replaceAll('-', '')}`;
	let orm: MikroORM;

	before(async () => {
		orm = await MikroORM.init({
			...ENTITY_MAPPING_OPTIONS,
			clientUrl: DATABASE_URL,
			entities: [
				BillingEvidenceBundle,
				EdgeUsageCheckpoint,
				ExposureNetworkUsage,
				MachineUsageReceipt,
			],
			driverOptions: { options: `-c search_path=${schema}` },
		});
		const connection = orm.em.getConnection();
		await connection.execute(`CREATE SCHEMA ${schema}`);
		for (const statement of SCHEMA_SQL) await connection.execute(statement);
		const [resolved] = await connection.execute<{ schema: string }[]>(
			`SELECT n.nspname AS schema FROM pg_class c
			 JOIN pg_namespace n ON n.oid = c.relnamespace
			 WHERE c.oid = 'billing_line_item'::regclass`
		);
		assert.equal(resolved?.schema, schema, 'tables resolve to the test schema');
	});

	after(async () => {
		if (!orm) return;
		await orm.em.getConnection().execute(`DROP SCHEMA ${schema} CASCADE`);
		await orm.close(true);
	});

	it('prunes only evidence posted before the audit window', async () => {
		const fixture = await seed(orm);
		const service = new BillingEvidenceRetentionService(orm.em);

		const pruned = await service.prunePostedEvidence();

		assert.deepEqual(pruned, {
			evidenceBundles: 1,
			networkUsage: 2,
			edgeCheckpoints: 1,
			usageReceipts: LONG_CHAIN_RECEIPTS + 1,
		});
		assert.deepEqual(
			await ids(orm, 'billing_evidence_bundle'),
			sorted(fixture.keptBundles)
		);
		assert.deepEqual(
			await ids(orm, 'exposure_network_usage'),
			sorted(fixture.keptNetworkUsage)
		);
		assert.deepEqual(
			await ids(orm, 'edge_usage_checkpoint'),
			sorted(fixture.keptCheckpoints)
		);
		assert.deepEqual(
			await column(orm, 'machine_usage_receipt', '"placementId"'),
			sorted(fixture.keptReceiptPlacements)
		);
		assert.equal(
			(await ids(orm, 'billing_line_item')).length,
			fixture.lineCount,
			'billing lines are financial records and are never pruned'
		);
		assert.deepEqual(
			await column(orm, 'billing_line_quarantine', '"lineItemId"'),
			sorted(fixture.quarantinedLines),
			'quarantines are never pruned'
		);

		assert.deepEqual(
			await service.prunePostedEvidence(),
			{
				evidenceBundles: 0,
				networkUsage: 0,
				edgeCheckpoints: 0,
				usageReceipts: 0,
			},
			'a second run finds nothing left to prune'
		);
	});
});

interface Fixture {
	keptBundles: string[];
	keptNetworkUsage: string[];
	keptCheckpoints: string[];
	keptReceiptPlacements: string[];
	lineCount: number;
	quarantinedLines: string[];
}

async function seed(orm: MikroORM): Promise<Fixture> {
	const connection = orm.em.getConnection();
	let lineCount = 0;
	const quarantinedLines: string[] = [];
	const line = async (
		placementId: string,
		reconciledDaysAgo: number | null,
		options: { quarantined?: boolean; sourceId?: string } = {}
	) => {
		const id = randomUUID();
		lineCount += 1;
		await connection.execute(
			`INSERT INTO billing_line_item (id, "placementId", "sourceType", "sourceId", "evidenceStatus", "reconciledAt")
			 VALUES (?, ?, ?, ?, ?, ?)`,
			[
				id,
				placementId,
				options.sourceId
					? BillingLineSourceType.NETWORK_USAGE_PERIOD
					: BillingLineSourceType.SANDBOX_USAGE_PERIOD,
				options.sourceId ?? randomUUID(),
				reconciledDaysAgo === null
					? BillingEvidenceStatus.PENDING
					: BillingEvidenceStatus.CORROBORATED,
				reconciledDaysAgo === null ? null : daysAgo(reconciledDaysAgo),
			]
		);
		if (options.quarantined) {
			quarantinedLines.push(id);
			await connection.execute(
				'INSERT INTO billing_line_quarantine ("lineItemId") VALUES (?)',
				[id]
			);
		}
		return id;
	};
	const placement = async (releasedDaysAgo: number | null) => {
		const id = randomUUID();
		await connection.execute(
			'INSERT INTO sandbox_placement (id, "releasedAt") VALUES (?, ?)',
			[id, releasedDaysAgo === null ? null : daysAgo(releasedDaysAgo)]
		);
		return id;
	};
	const bundle = async (lineItemId: string) => {
		const id = randomUUID();
		await connection.execute(
			'INSERT INTO billing_evidence_bundle (id, "lineItemId", "createdAt") VALUES (?, ?, ?)',
			[id, lineItemId, daysAgo(AGE.older)]
		);
		return id;
	};
	const receipts = async (placementId: string, count: number) => {
		await connection.execute(
			`WITH chain AS (
				SELECT n, gen_random_uuid() AS id FROM generate_series(1, ?) AS n
			)
			INSERT INTO machine_usage_receipt (id, "placementId", "predecessorId", "sampledAt")
			SELECT chain.id, ?, previous.id, ?::timestamptz + chain.n * interval '1 second'
			FROM chain LEFT JOIN chain previous ON previous.n = chain.n - 1
			ORDER BY chain.n`,
			[count, placementId, daysAgo(AGE.older)]
		);
	};
	const checkpoint = async (
		edgeId: string,
		usageEpoch: number,
		sequence: number
	) => {
		const id = randomUUID();
		await connection.execute(
			'INSERT INTO edge_usage_checkpoint (id, "edgeId", "usageEpoch", sequence, "intervalEndedAt") VALUES (?, ?, ?, ?, ?)',
			[id, edgeId, usageEpoch, sequence, daysAgo(AGE.older)]
		);
		return id;
	};
	const networkUsage = async (
		checkpointId: string,
		ratedDaysAgo: number | null
	) => {
		const id = randomUUID();
		const periodId = ratedDaysAgo === null ? null : randomUUID();
		await connection.execute(
			'INSERT INTO exposure_network_usage (id, "edgeCheckpointId", "periodId", "createdAt") VALUES (?, ?, ?, ?)',
			[
				id,
				checkpointId,
				periodId,
				ratedDaysAgo === null ? new Date() : daysAgo(ratedDaysAgo),
			]
		);
		return { id, periodId };
	};

	const postedLong = await placement(AGE.expired);
	await line(postedLong, AGE.expired);
	await receipts(postedLong, LONG_CHAIN_RECEIPTS);
	const postedShort = await placement(AGE.older);
	await receipts(postedShort, 1);
	const unposted = await placement(AGE.expired);
	await line(unposted, null);
	await receipts(unposted, KEPT_CHAIN_RECEIPTS);
	const live = await placement(null);
	await receipts(live, KEPT_CHAIN_RECEIPTS);
	const recentlyReleased = await placement(AGE.recent);
	await receipts(recentlyReleased, KEPT_CHAIN_RECEIPTS);
	const quarantinedPlacement = await placement(AGE.expired);
	await line(quarantinedPlacement, AGE.expired, { quarantined: true });
	await receipts(quarantinedPlacement, KEPT_CHAIN_RECEIPTS);

	const bundlePlacement = await placement(null);
	await bundle(await line(bundlePlacement, AGE.expired));
	const keptBundles = [
		await bundle(await line(bundlePlacement, AGE.recent)),
		await bundle(await line(bundlePlacement, null)),
		await bundle(
			await line(bundlePlacement, AGE.expired, { quarantined: true })
		),
	];

	const edgeId = randomUUID();
	const prunedCheckpoint = await checkpoint(edgeId, 1, 5);
	const referencedCheckpoint = await checkpoint(edgeId, 2, 1);
	const edgeHead = await checkpoint(edgeId, 2, 2);
	const idleEdgeHead = await checkpoint(randomUUID(), 1, 1);
	const postedUsage = await networkUsage(prunedCheckpoint, AGE.expired);
	await line(bundlePlacement, AGE.expired, {
		sourceId: postedUsage.periodId ?? undefined,
	});
	await networkUsage(prunedCheckpoint, AGE.expired);
	const unpostedUsage = await networkUsage(referencedCheckpoint, AGE.expired);
	await line(bundlePlacement, null, {
		sourceId: unpostedUsage.periodId ?? undefined,
	});
	const keptNetworkUsage = [
		unpostedUsage.id,
		(await networkUsage(referencedCheckpoint, null)).id,
		(await networkUsage(edgeHead, AGE.recent)).id,
	];

	return {
		keptBundles,
		keptNetworkUsage,
		keptCheckpoints: [referencedCheckpoint, edgeHead, idleEdgeHead],
		keptReceiptPlacements: [
			...Array(KEPT_CHAIN_RECEIPTS).fill(unposted),
			...Array(KEPT_CHAIN_RECEIPTS).fill(live),
			...Array(KEPT_CHAIN_RECEIPTS).fill(recentlyReleased),
			...Array(KEPT_CHAIN_RECEIPTS).fill(quarantinedPlacement),
		],
		lineCount,
		quarantinedLines,
	};
}

function sorted(values: readonly string[]): string[] {
	return [...values].sort();
}

async function column(
	orm: MikroORM,
	table: string,
	name: string
): Promise<string[]> {
	const rows = await orm.em
		.getConnection()
		.execute<{ value: string }[]>(
			`SELECT ${name} AS value FROM ${table} ORDER BY ${name}`
		);
	return sorted(rows.map(({ value }) => value));
}

function ids(orm: MikroORM, table: string): Promise<string[]> {
	return column(orm, table, 'id');
}
