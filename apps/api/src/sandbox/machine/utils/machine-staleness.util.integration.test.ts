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
import { type EntityManager, MikroORM } from '@mikro-orm/postgresql';
import { integrationDatabaseUrl } from '../../../common/testing/integration-database.util';
import { addMilliseconds } from '../../../common/utils/time.util';
import { ENTITY_MAPPING_OPTIONS } from '../../../infra/database/config/entity-mapping.config';
import { JOB_MACHINE_API_VERSION } from '../constants/machine.constants';
import { Machine } from '../entities/machine.entity';
import { MachineState } from '../enums/machine-state.enum';
import { staleMachineFilter } from './machine-staleness.util';

const DATABASE_URL = integrationDatabaseUrl();
const TEST_PREFIX = 'machine-staleness-test';
const STALE_OFFSET_MS = -1_000;

describe('staleMachineFilter', {
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

	it('selects ready and draining machines that stopped heartbeating, never decommissioned ones', async () => {
		const manager = orm.em.fork();
		await manager.begin();
		try {
			const staleBefore = new Date();
			const lastChecked = addMilliseconds(staleBefore, STALE_OFFSET_MS);
			const machines = await Promise.all(
				Object.values(MachineState).map((state) =>
					staleMachine(manager, state, lastChecked)
				)
			);
			manager.persist(machines);
			await manager.flush();

			const stale = await manager.find(Machine, {
				...staleMachineFilter(staleBefore),
				id: { $in: machines.map(({ id }) => id) },
			});

			assert.deepEqual(stale.map(({ state }) => state).sort(), [
				MachineState.DRAINING,
				MachineState.READY,
			]);
		} finally {
			await manager.rollback();
		}
	});
});

async function staleMachine(
	manager: EntityManager,
	state: MachineState,
	lastChecked: Date
): Promise<Machine> {
	const organizationId = randomUUID();
	await manager.execute(
		'INSERT INTO organization (id, name, slug) VALUES (?, ?, ?)',
		[organizationId, TEST_PREFIX, `${TEST_PREFIX}-${organizationId}`]
	);
	const machine = new Machine({
		name: `${TEST_PREFIX}-${randomUUID()}`,
		apiVersion: JOB_MACHINE_API_VERSION,
		organizationId,
	});
	machine.state = state;
	machine.lastChecked = lastChecked;
	return machine;
}
