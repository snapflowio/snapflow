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
import { type EntityManager, MikroORM } from '@mikro-orm/postgresql';
import { NotFoundException } from '@nestjs/common';
import { integrationDatabaseUrl } from '../../common/testing/integration-database.util';
import { ENTITY_MAPPING_OPTIONS } from '../../infra/database/config/entity-mapping.config';
import { SOFT_DELETED_SANDBOX_NAME_PREFIX } from '../../sandbox/constants/sandbox.constants';
import {
	BillingAdjustmentKind,
	BillingChargeClass,
	BillingEvidenceStatus,
} from '../constants/billing.constants';
import {
	type BillingSandboxUsageDto,
	ListBillingSandboxUsageQueryDto,
} from '../dto/billing.dto';
import { BillingEvidenceBundle } from '../entities/billing-evidence-bundle.entity';
import { BillingLineQueryService } from '../services/billing-line-query.service';
import {
	SandboxUsageSort,
	SandboxUsageSortDirection,
} from './sandbox-usage.query';

const DATABASE_URL = integrationDatabaseUrl();
const ORGANIZATION_ID = '10000000-0000-4000-8000-000000000001';
const OTHER_ORGANIZATION_ID = '10000000-0000-4000-8000-000000000002';
const NAMED_SANDBOX_ID = '20000000-0000-4000-8000-000000000001';
const FOREIGN_NAMED_SANDBOX_ID = '20000000-0000-4000-8000-000000000002';
const UNNAMED_SANDBOX_ID = '20000000-0000-4000-8000-000000000004';
const OTHER_ORGANIZATION_SANDBOX_ID = '20000000-0000-4000-8000-000000000009';
const ADJUSTED_LINE_ID = '30000000-0000-4000-8000-000000000001';
const SANDBOX_NAME = 'alpha';
const FOREIGN_SANDBOX_NAME = 'foreign';
const SOFT_DELETED_AT_MILLISECONDS = 1_791_132_168_684;
const SOFT_DELETED_SANDBOX_NAME = `${SOFT_DELETED_SANDBOX_NAME_PREFIX}${UNNAMED_SANDBOX_ID}_${SOFT_DELETED_AT_MILLISECONDS}`;
const LATEST_SERVICE_THROUGH = '2026-10-02T10:00:00.123456Z';
const TIED_SERVICE_THROUGH = '2026-10-01T10:00:00.000500Z';
const EARLIEST_SERVICE_START = '2026-10-01T00:00:00.000Z';
const SECOND_DAY_START = '2026-10-02T00:00:00.000Z';
const PAGE_LIMIT = 1;
const ID_SUFFIX_LENGTH = 8;

describe('sandbox usage query', {
	skip: DATABASE_URL ? false : 'DATABASE_URL is not configured',
}, () => {
	let orm: MikroORM;

	before(async () => {
		orm = await MikroORM.init({
			...ENTITY_MAPPING_OPTIONS,
			clientUrl: DATABASE_URL,
			entities: [BillingEvidenceBundle],
		});
	});

	after(async () => {
		await orm?.close(true);
	});

	it('aggregates effective usage per sandbox, newest first, across pages', async () => {
		await orm.em.fork().transactional(async (entityManager) => {
			await seedBillingLines(entityManager);
			const service = new BillingLineQueryService(entityManager);

			const pages: BillingSandboxUsageDto[][] = [];
			let cursor: string | undefined;
			do {
				const query = Object.assign(new ListBillingSandboxUsageQueryDto(), {
					limit: PAGE_LIMIT,
					cursor,
				});
				const page = await service.sandboxUsage(ORGANIZATION_ID, query);
				pages.push(page.items);
				cursor = page.nextCursor ?? undefined;
			} while (cursor);

			assert.deepEqual(
				pages.map((items) => items.map(({ sandboxId }) => sandboxId)),
				[[NAMED_SANDBOX_ID], [UNNAMED_SANDBOX_ID], [FOREIGN_NAMED_SANDBOX_ID]]
			);
			const [[named], [unnamed], [foreignNamed]] = pages;
			assert.deepEqual(named, {
				sandboxId: NAMED_SANDBOX_ID,
				sandboxName: SANDBOX_NAME,
				computeMicroUsd: '900',
				networkMicroUsd: '200',
				totalMicroUsd: '1100',
				lineCount: 2,
				firstServiceStart: new Date(EARLIEST_SERVICE_START),
				lastServiceThrough: new Date('2026-10-02T10:00:00.123Z'),
				evidence: {
					pending: 1,
					corroborated: 1,
				},
			});
			assert.equal(unnamed.sandboxName, undefined);
			assert.equal(unnamed.totalMicroUsd, '300');
			assert.equal(unnamed.evidence.corroborated, 1);
			assert.equal(foreignNamed.sandboxName, undefined);
			assert.equal(foreignNamed.computeMicroUsd, '500');
			assert.equal(foreignNamed.networkMicroUsd, '0');
			assert.equal(foreignNamed.evidence.pending, 1);
		});
	});

	it('orders by total cost in either direction across pages', async () => {
		await orm.em.fork().transactional(async (entityManager) => {
			await seedBillingLines(entityManager);
			const service = new BillingLineQueryService(entityManager);

			assert.deepEqual(
				await listSandboxIds(service, {
					sort: SandboxUsageSort.TOTAL,
					direction: SandboxUsageSortDirection.DESC,
				}),
				[NAMED_SANDBOX_ID, FOREIGN_NAMED_SANDBOX_ID, UNNAMED_SANDBOX_ID]
			);
			assert.deepEqual(
				await listSandboxIds(service, {
					sort: SandboxUsageSort.TOTAL,
					direction: SandboxUsageSortDirection.ASC,
				}),
				[UNNAMED_SANDBOX_ID, FOREIGN_NAMED_SANDBOX_ID, NAMED_SANDBOX_ID]
			);
		});
	});

	it('searches sandbox names and ids case-insensitively', async () => {
		await orm.em.fork().transactional(async (entityManager) => {
			await seedBillingLines(entityManager);
			const service = new BillingLineQueryService(entityManager);

			assert.deepEqual(
				await listSandboxIds(service, { search: SANDBOX_NAME.toUpperCase() }),
				[NAMED_SANDBOX_ID]
			);
			assert.deepEqual(
				await listSandboxIds(service, {
					search: UNNAMED_SANDBOX_ID.slice(-ID_SUFFIX_LENGTH),
				}),
				[UNNAMED_SANDBOX_ID]
			);
		});
	});

	it('limits rows and the total to the service window', async () => {
		await orm.em.fork().transactional(async (entityManager) => {
			await seedBillingLines(entityManager);
			const service = new BillingLineQueryService(entityManager);

			const all = await service.sandboxUsage(
				ORGANIZATION_ID,
				new ListBillingSandboxUsageQueryDto()
			);
			assert.equal(all.totalMicroUsd, '1900');

			const windowed = await service.sandboxUsage(
				ORGANIZATION_ID,
				Object.assign(new ListBillingSandboxUsageQueryDto(), {
					from: new Date(SECOND_DAY_START),
				})
			);
			assert.deepEqual(
				windowed.items.map(({ sandboxId, totalMicroUsd }) => ({
					sandboxId,
					totalMicroUsd,
				})),
				[{ sandboxId: NAMED_SANDBOX_ID, totalMicroUsd: '200' }]
			);
			assert.equal(windowed.totalMicroUsd, '200');

			const before = await service.sandboxUsage(
				ORGANIZATION_ID,
				Object.assign(new ListBillingSandboxUsageQueryDto(), {
					to: new Date(SECOND_DAY_START),
				})
			);
			assert.equal(before.totalMicroUsd, '1700');
		});
	});

	it('summarizes one sandbox of the user', async () => {
		await orm.em.fork().transactional(async (entityManager) => {
			await seedBillingLines(entityManager);
			const service = new BillingLineQueryService(entityManager);

			const summary = await service.sandboxUsageSummary(
				ORGANIZATION_ID,
				NAMED_SANDBOX_ID
			);
			assert.equal(summary.sandboxName, SANDBOX_NAME);
			assert.equal(summary.totalMicroUsd, '1100');
			assert.equal(summary.lineCount, 2);
			await assert.rejects(
				service.sandboxUsageSummary(
					ORGANIZATION_ID,
					OTHER_ORGANIZATION_SANDBOX_ID
				),
				NotFoundException
			);
		});
	});
});

async function listSandboxIds(
	service: BillingLineQueryService,
	filters: Partial<
		Pick<ListBillingSandboxUsageQueryDto, 'search' | 'sort' | 'direction'>
	>
): Promise<string[]> {
	const sandboxIds: string[] = [];
	let cursor: string | undefined;
	do {
		const query = Object.assign(new ListBillingSandboxUsageQueryDto(), {
			...filters,
			limit: PAGE_LIMIT,
			cursor,
		});
		const page = await service.sandboxUsage(ORGANIZATION_ID, query);
		sandboxIds.push(...page.items.map(({ sandboxId }) => sandboxId));
		cursor = page.nextCursor ?? undefined;
	} while (cursor);
	return sandboxIds;
}

async function seedBillingLines(entityManager: EntityManager): Promise<void> {
	await entityManager.execute(`CREATE TEMPORARY TABLE billing_line_item (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			"customerOrganizationId" uuid NOT NULL,
			"sandboxId" varchar NOT NULL,
			"chargeClass" varchar NOT NULL,
			"grossMicroUsd" numeric NOT NULL,
			"evidenceStatus" varchar NOT NULL,
			"periodStart" timestamptz NOT NULL,
			"serviceThrough" timestamptz NOT NULL
		) ON COMMIT DROP`);
	await entityManager.execute(`CREATE TEMPORARY TABLE billing_line_adjustment (
			"lineItemId" uuid NOT NULL,
			kind varchar NOT NULL,
			"amountMicroUsd" numeric NOT NULL
		) ON COMMIT DROP`);
	await entityManager.execute(`CREATE TEMPORARY TABLE sandbox (
			id varchar NOT NULL,
			"organizationId" uuid NOT NULL,
			name varchar NOT NULL
		) ON COMMIT DROP`);
	await entityManager.execute(
		`INSERT INTO sandbox (id, "organizationId", name) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)`,
		[
			UNNAMED_SANDBOX_ID,
			ORGANIZATION_ID,
			SOFT_DELETED_SANDBOX_NAME,
			NAMED_SANDBOX_ID,
			ORGANIZATION_ID,
			SANDBOX_NAME,
			FOREIGN_NAMED_SANDBOX_ID,
			OTHER_ORGANIZATION_ID,
			FOREIGN_SANDBOX_NAME,
		]
	);
	const lines = [
		[
			ADJUSTED_LINE_ID,
			ORGANIZATION_ID,
			NAMED_SANDBOX_ID,
			BillingChargeClass.COMPUTE,
			'1000',
			BillingEvidenceStatus.CORROBORATED,
			EARLIEST_SERVICE_START,
			'2026-10-01T12:00:00.000Z',
		],
		[
			null,
			ORGANIZATION_ID,
			NAMED_SANDBOX_ID,
			BillingChargeClass.NETWORK,
			'200',
			BillingEvidenceStatus.PENDING,
			'2026-10-02T09:00:00.000Z',
			LATEST_SERVICE_THROUGH,
		],
		[
			null,
			ORGANIZATION_ID,
			FOREIGN_NAMED_SANDBOX_ID,
			BillingChargeClass.COMPUTE,
			'500',
			BillingEvidenceStatus.PENDING,
			EARLIEST_SERVICE_START,
			TIED_SERVICE_THROUGH,
		],
		[
			null,
			ORGANIZATION_ID,
			UNNAMED_SANDBOX_ID,
			BillingChargeClass.NETWORK,
			'300',
			BillingEvidenceStatus.CORROBORATED,
			EARLIEST_SERVICE_START,
			TIED_SERVICE_THROUGH,
		],
		[
			null,
			OTHER_ORGANIZATION_ID,
			OTHER_ORGANIZATION_SANDBOX_ID,
			BillingChargeClass.COMPUTE,
			'700',
			BillingEvidenceStatus.CORROBORATED,
			EARLIEST_SERVICE_START,
			'2026-10-03T00:00:00.000Z',
		],
	];
	for (const line of lines) {
		await entityManager.execute(
			`INSERT INTO billing_line_item (
					id, "customerOrganizationId", "sandboxId", "chargeClass", "grossMicroUsd",
					"evidenceStatus", "periodStart", "serviceThrough"
				) VALUES (COALESCE(?::uuid, gen_random_uuid()), ?, ?, ?, ?, ?, ?, ?)`,
			line
		);
	}
	await entityManager.execute(
		`INSERT INTO billing_line_adjustment ("lineItemId", kind, "amountMicroUsd") VALUES (?, ?, ?)`,
		[ADJUSTED_LINE_ID, BillingAdjustmentKind.CREDIT, '100']
	);
}
