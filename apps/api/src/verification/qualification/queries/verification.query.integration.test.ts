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
import { addMilliseconds, addMinutes } from '../../../common/utils/time.util';
import { ENTITY_MAPPING_OPTIONS } from '../../../infra/database/config/entity-mapping.config';
import { JOB_MACHINE_API_VERSION } from '../../../sandbox/machine/constants/machine.constants';
import { Machine } from '../../../sandbox/machine/entities/machine.entity';
import { MachineState } from '../../../sandbox/machine/enums/machine-state.enum';
import {
	BENCHMARK_POLICY,
	BENCHMARK_SUITE_VERSION,
} from '../constants/benchmark-policy.constants';
import { MachineBenchmark } from '../entities/machine-benchmark.entity';
import { BenchmarkState } from '../enums/benchmark-state.enum';
import { BenchmarkTrigger } from '../enums/benchmark-trigger.enum';
import { findMachinesDueForBenchmark } from './verification.query';

const DATABASE_URL = integrationDatabaseUrl();
const TEST_PREFIX = 'benchmark-due-test';
const DUE_LIMIT = 1_000;
const ISSUED_MINUTES_AGO = -2;
const COMPLETED_MINUTES_AGO = -1;
const HEARTBEAT_GAP_MS = 1_000;
const CHALLENGE_UNITS = 1;

describe('findMachinesDueForBenchmark', {
	skip: DATABASE_URL ? false : 'DATABASE_URL is not configured',
}, () => {
	let orm: MikroORM;

	before(async () => {
		orm = await MikroORM.init({
			...ENTITY_MAPPING_OPTIONS,
			clientUrl: DATABASE_URL,
			entities: [Machine, MachineBenchmark],
		});
	});

	after(async () => {
		await orm?.close(true);
	});

	it('reissues a challenge the machine could not admit once a fresher heartbeat arrives', async () => {
		await scenario(async (manager, now) => {
			const completedAt = addMinutes(now, COMPLETED_MINUTES_AGO);
			const refreshed = await machineWithBenchmark(manager, now, {
				state: BenchmarkState.NOT_ADMITTED,
				completedAt,
				lastChecked: addMilliseconds(completedAt, HEARTBEAT_GAP_MS),
			});
			const stale = await machineWithBenchmark(manager, now, {
				state: BenchmarkState.NOT_ADMITTED,
				completedAt,
				lastChecked: addMilliseconds(completedAt, -HEARTBEAT_GAP_MS),
			});
			const failed = await machineWithBenchmark(manager, now, {
				state: BenchmarkState.FAILED,
				completedAt,
				lastChecked: addMilliseconds(completedAt, HEARTBEAT_GAP_MS),
			});

			const due = new Set(
				(
					await findMachinesDueForBenchmark(
						manager,
						addMinutes(now, -BENCHMARK_POLICY.REISSUE_INTERVAL_MINUTES),
						DUE_LIMIT
					)
				).map(({ machineId }) => machineId)
			);

			assert.equal(due.has(refreshed), true);
			assert.equal(due.has(stale), false);
			assert.equal(due.has(failed), false);
		});
	});

	async function scenario(
		body: (manager: EntityManager, now: Date) => Promise<void>
	): Promise<void> {
		const manager = orm.em.fork();
		await manager.begin();
		try {
			await body(manager, new Date());
		} finally {
			await manager.rollback();
		}
	}
});

async function machineWithBenchmark(
	manager: EntityManager,
	now: Date,
	outcome: { state: BenchmarkState; completedAt: Date; lastChecked: Date }
): Promise<string> {
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
	machine.state = MachineState.READY;
	machine.identityKeyId = `${TEST_PREFIX}-${randomUUID()}`;
	machine.lastChecked = outcome.lastChecked;
	manager.persist(machine);
	const benchmark = new MachineBenchmark();
	benchmark.machineId = machine.id;
	benchmark.trigger = BenchmarkTrigger.REGISTRATION;
	benchmark.state = outcome.state;
	benchmark.suiteVersion = BENCHMARK_SUITE_VERSION;
	benchmark.nonce = randomUUID();
	benchmark.cpu = CHALLENGE_UNITS;
	benchmark.memoryGib = CHALLENGE_UNITS;
	benchmark.diskGib = CHALLENGE_UNITS;
	benchmark.gpu = 0;
	benchmark.issuedAt = addMinutes(now, ISSUED_MINUTES_AGO);
	benchmark.expiresAt = addMinutes(now, BENCHMARK_POLICY.CHALLENGE_TTL_MINUTES);
	benchmark.completedAt = outcome.completedAt;
	manager.persist(benchmark);
	await manager.flush();
	return machine.id;
}
