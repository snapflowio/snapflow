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
import { QueryOrder } from '@mikro-orm/core';
import { type EntityManager, MikroORM } from '@mikro-orm/postgresql';
import { ENTITY_MAPPING_OPTIONS } from '../../../infra/database/config/entity-mapping.config';
import { JOB_MACHINE_API_VERSION } from '../../../machine/constants/machine.constants';
import { Machine } from '../../../machine/entities/machine.entity';
import { integrationDatabaseUrl } from '../../testing/integration-database.util';
import { findCursorPage } from './cursor-page.util';

const DATABASE_URL = integrationDatabaseUrl();
const TEST_PREFIX = 'cursor-page-test';
const PAGE_SIZE = 2;
const SAME_MILLISECOND_OFFSETS_MICROSECONDS = [
	0, 100, 200, 300, 400, 1_100, 1_200,
];
const MICROSECONDS_PER_SECOND = 1_000_000;
const BASE_TIMESTAMP = '2026-01-01T00:00:00.000Z';
const ORDER = { createdAt: QueryOrder.DESC, id: QueryOrder.DESC } as const;

describe('findCursorPage over timestamps', {
	skip: DATABASE_URL ? false : 'DATABASE_URL is not configured',
}, () => {
	let orm: MikroORM;

	before(async () => {
		orm = await MikroORM.init({
			...ENTITY_MAPPING_OPTIONS,
			clientUrl: DATABASE_URL,
			entities: [Machine],
		});
	});

	after(async () => {
		await orm?.close(true);
	});

	it('returns every row exactly once when rows share a millisecond', async () => {
		const manager = orm.em.fork();
		await manager.begin();
		try {
			const organizationId = await insertMachines(manager);

			const expected = (
				await manager.find(Machine, { organizationId }, { orderBy: ORDER })
			).map(({ id }) => id);
			const paged: string[] = [];
			let cursor: string | undefined;
			do {
				const page = await findCursorPage(manager, Machine, {
					where: { organizationId },
					orderBy: ORDER,
					limit: PAGE_SIZE,
					cursor,
				});
				paged.push(...page.items.map(({ id }) => id));
				cursor = page.nextCursor ?? undefined;
			} while (cursor);

			assert.equal(
				expected.length,
				SAME_MILLISECOND_OFFSETS_MICROSECONDS.length
			);
			assert.deepEqual(paged, expected);
		} finally {
			await manager.rollback();
		}
	});
});

async function insertMachines(manager: EntityManager): Promise<string> {
	const organizationId = randomUUID();
	await manager.execute(
		'INSERT INTO organization (id, name, slug) VALUES (?, ?, ?)',
		[organizationId, TEST_PREFIX, `${TEST_PREFIX}-${organizationId}`]
	);
	const machines = SAME_MILLISECOND_OFFSETS_MICROSECONDS.map(
		() =>
			new Machine({
				name: `${TEST_PREFIX}-${randomUUID()}`,
				apiVersion: JOB_MACHINE_API_VERSION,
				organizationId,
			})
	);
	manager.persist(machines);
	await manager.flush();
	for (const [index, machine] of machines.entries()) {
		await manager.execute(
			'UPDATE machine SET "createdAt" = ?::timestamptz + make_interval(secs => ?) WHERE id = ?',
			[
				BASE_TIMESTAMP,
				SAME_MILLISECOND_OFFSETS_MICROSECONDS[index] / MICROSECONDS_PER_SECOND,
				machine.id,
			]
		);
	}
	manager.clear();
	return organizationId;
}
