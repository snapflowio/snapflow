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
import { integrationDatabaseUrl } from '../../../common/testing/integration-database.util';
import { ENTITY_MAPPING_OPTIONS } from '../../../infra/database/config/entity-mapping.config';
import { Organization } from '../../../organization/entities/organization.entity';
import { User } from '../../../user/entities/user.entity';
import { MachineBenchmark } from '../../../verification/entities/machine-benchmark.entity';
import {
	ListSandboxesQueryDto,
	SandboxListSortDirection,
	SandboxListSortField,
} from '../../dto/list-sandboxes-query.dto';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxLastActivity } from '../../entities/sandbox-last-activity.entity';
import { SandboxMode } from '../../enums/sandbox-mode.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { Machine } from '../../machine/entities/machine.entity';
import { BuildInfo } from '../../snapshot/entities/build-info.entity';
import { SandboxSearchService } from './sandbox-search.service';

const DATABASE_URL = integrationDatabaseUrl();
const OS_USER = 'snapflow';
const SANDBOX_COUNT = 5;
const PAGE_SIZE = 2;
const ACTIVITY_STEP_MILLISECONDS = 60_000;
const ACTIVITY_ORIGIN = Date.parse('2026-10-19T12:00:00.000Z');

function listQuery(
	sort: SandboxListSortField,
	order: SandboxListSortDirection,
	cursor?: string
): ListSandboxesQueryDto {
	return Object.assign(new ListSandboxesQueryDto(), {
		sort,
		order,
		limit: PAGE_SIZE,
		cursor,
	});
}

describe('sandbox list pagination', {
	skip: DATABASE_URL ? false : 'DATABASE_URL is not configured',
}, () => {
	let orm: MikroORM;
	const organizationId = randomUUID();
	const sandboxes = Array.from({ length: SANDBOX_COUNT }, () =>
		Object.assign(new Sandbox({}), {
			organizationId,
			mode: SandboxMode.EPHEMERAL,
			osUser: OS_USER,
			state: SandboxState.STARTED,
		})
	);

	before(async () => {
		orm = await MikroORM.init({
			...ENTITY_MAPPING_OPTIONS,
			clientUrl: DATABASE_URL,
			entities: [
				Organization,
				User,
				Machine,
				MachineBenchmark,
				Sandbox,
				SandboxLastActivity,
				BuildInfo,
			],
		});
		const manager = orm.em.fork();
		await manager.execute(
			'INSERT INTO organization (id, name, slug) VALUES (?, ?, ?)',
			[organizationId, organizationId, organizationId]
		);
		manager.persist(sandboxes);
		await manager.flush();
		sandboxes.forEach((sandbox, index) => {
			manager.persist(
				Object.assign(new SandboxLastActivity(), {
					sandbox,
					lastActivityAt: new Date(
						ACTIVITY_ORIGIN +
							((index * 3) % SANDBOX_COUNT) * ACTIVITY_STEP_MILLISECONDS
					),
				})
			);
		});
		await manager.flush();
	});

	after(async () => {
		if (!orm) return;
		const manager = orm.em.fork();
		await manager.nativeDelete(Sandbox, {
			id: { $in: sandboxes.map(({ id }) => id) },
		});
		await manager.execute('DELETE FROM organization WHERE id = ?', [
			organizationId,
		]);
		await orm.close(true);
	});

	async function pagedIds(
		sort: SandboxListSortField,
		order: SandboxListSortDirection
	): Promise<string[]> {
		const service = new SandboxSearchService(orm.em.fork());
		const ids: string[] = [];
		let cursor: string | undefined;
		do {
			const page = await service.search(
				organizationId,
				listQuery(sort, order, cursor)
			);
			ids.push(...page.items.map(({ id }) => id));
			cursor = page.nextCursor ?? undefined;
		} while (cursor);
		return ids;
	}

	for (const sort of [
		SandboxListSortField.LAST_ACTIVITY_AT,
		SandboxListSortField.CREATED_AT,
	]) {
		for (const order of Object.values(SandboxListSortDirection)) {
			it(`pages through every sandbox once sorted by ${sort} ${order}`, async () => {
				const service = new SandboxSearchService(orm.em.fork());
				const whole = await service.search(
					organizationId,
					Object.assign(listQuery(sort, order), { limit: SANDBOX_COUNT })
				);
				assert.deepEqual(
					await pagedIds(sort, order),
					whole.items.map(({ id }) => id)
				);
			});
		}
	}

	it('filters on the last activity window', async () => {
		const service = new SandboxSearchService(orm.em.fork());
		const page = await service.search(
			organizationId,
			Object.assign(
				listQuery(
					SandboxListSortField.LAST_ACTIVITY_AT,
					SandboxListSortDirection.ASC
				),
				{
					limit: SANDBOX_COUNT,
					lastEventAfter: new Date(
						ACTIVITY_ORIGIN + ACTIVITY_STEP_MILLISECONDS
					),
					lastEventBefore: new Date(
						ACTIVITY_ORIGIN + 3 * ACTIVITY_STEP_MILLISECONDS
					),
				}
			)
		);
		assert.equal(page.items.length, 3);
	});
});
