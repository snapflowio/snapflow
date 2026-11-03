/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EntityManager } from '@mikro-orm/postgresql';
import { fakeInstance } from '../../../common/testing/instance.fake';
import { NO_KEY_UPDATE_LOCK } from '../../../infra/database/utils/row-lock.util';
import { Machine } from '../../../sandbox/machine/entities/machine.entity';
import { EXPOSURE_BACKEND_STATE } from '../constants/exposure.constants';
import { Edge } from '../entities/edge.entity';
import { Exposure } from '../entities/exposure.entity';
import { ExposureBackend } from '../entities/exposure-backend.entity';
import { MachineEdgeBinding } from '../entities/machine-edge-binding.entity';
import { lockExposureNetwork, lockNetworkScope } from './network-lock.util';

const UUID_ID_PROPERTIES = { id: { columnTypes: ['uuid'] } };

const EXPOSURE_ID = '0e000000-0000-4000-8000-000000000000';
const LOW_MACHINE_ID = '1a000000-0000-4000-8000-000000000000';
const HIGH_MACHINE_ID = '9a000000-0000-4000-8000-000000000000';
const LOW_EDGE_ID = '2b000000-0000-4000-8000-000000000000';
const HIGH_EDGE_ID = '8b000000-0000-4000-8000-000000000000';
const LOW_BINDING_ID = '3c000000-0000-4000-8000-000000000000';
const HIGH_BINDING_ID = '7c000000-0000-4000-8000-000000000000';
const OLDER_BACKEND_ID = 'f4000000-0000-4000-8000-000000000000';
const NEWER_BACKEND_ID = '04000000-0000-4000-8000-000000000000';
const TABLE_BY_ENTITY = new Map<unknown, string>([
	[Exposure, 'sandbox_exposure'],
	[Machine, 'machine'],
	[Edge, 'network_edge'],
	[MachineEdgeBinding, 'machine_edge_binding'],
	[ExposureBackend, 'sandbox_exposure_backend'],
]);
const LOCKED_TABLE_PATTERN = /FROM "(\w+)"/;

function backend(
	id: string,
	machineId: string,
	edgeId: string,
	bindingId: string
): ExposureBackend {
	return Object.assign(new ExposureBackend(), {
		id,
		exposureId: EXPOSURE_ID,
		machineId,
		edgeId,
		bindingId,
		state: EXPOSURE_BACKEND_STATE.ACTIVE,
	});
}

class NetworkStore {
	readonly locks: { table: string; ids: string[] }[] = [];
	readonly backends = [
		backend(OLDER_BACKEND_ID, HIGH_MACHINE_ID, HIGH_EDGE_ID, HIGH_BINDING_ID),
		backend(NEWER_BACKEND_ID, LOW_MACHINE_ID, LOW_EDGE_ID, LOW_BINDING_ID),
	];

	async execute(sql: string, [ids]: unknown[]): Promise<void> {
		assert.ok(sql.endsWith(NO_KEY_UPDATE_LOCK));
		assert.ok(Array.isArray(ids));
		const table = LOCKED_TABLE_PATTERN.exec(sql)?.[1];
		assert.ok(table);
		this.locks.push({ table, ids: ids.map(String) });
	}

	async find(
		entity: unknown,
		filter: { $and?: [{ id: { $in: string[] } }, unknown] }
	): Promise<unknown[]> {
		const reloaded = filter.$and?.[0].id.$in;
		if (entity === ExposureBackend) {
			return this.backends.filter(
				({ id }) => !reloaded || reloaded.includes(id)
			);
		}
		assert.ok(reloaded);
		if (entity === Exposure) {
			return reloaded.map((id) => Object.assign(new Exposure(), { id }));
		}
		return reloaded.map((id) => ({ id }));
	}

	getMetadata(entity: unknown) {
		const tableName = TABLE_BY_ENTITY.get(entity);
		assert.ok(tableName);
		return { tableName, primaryKeys: ['id'], properties: UUID_ID_PROPERTIES };
	}

	getPlatform(): { quoteIdentifier: (name: string) => string } {
		return { quoteIdentifier: (name) => `"${name}"` };
	}

	private readonly entityManager = fakeInstance(EntityManager, {
		execute: this.execute.bind(this),
		find: this.find.bind(this),
		getMetadata: this.getMetadata.bind(this),
		getPlatform: this.getPlatform.bind(this),
	});

	asEntityManager(): EntityManager {
		return this.entityManager;
	}
}

describe('networking lock order', () => {
	it('locks machines before edges, each in id order', async () => {
		const store = new NetworkStore();

		await lockNetworkScope(store.asEntityManager(), {
			machineIds: [HIGH_MACHINE_ID, LOW_MACHINE_ID],
			edgeIds: [HIGH_EDGE_ID, LOW_EDGE_ID, HIGH_EDGE_ID],
		});

		assert.deepEqual(store.locks, [
			{ table: 'machine', ids: [LOW_MACHINE_ID, HIGH_MACHINE_ID] },
			{ table: 'network_edge', ids: [LOW_EDGE_ID, HIGH_EDGE_ID] },
		]);
	});

	it('locks an exposure network level by level and keeps backend creation order', async () => {
		const store = new NetworkStore();

		const network = await lockExposureNetwork(store.asEntityManager(), [
			EXPOSURE_ID,
		]);

		assert.deepEqual(store.locks, [
			{ table: 'sandbox_exposure', ids: [EXPOSURE_ID] },
			{ table: 'machine', ids: [LOW_MACHINE_ID, HIGH_MACHINE_ID] },
			{ table: 'network_edge', ids: [LOW_EDGE_ID, HIGH_EDGE_ID] },
			{ table: 'machine_edge_binding', ids: [LOW_BINDING_ID, HIGH_BINDING_ID] },
			{
				table: 'sandbox_exposure_backend',
				ids: [NEWER_BACKEND_ID, OLDER_BACKEND_ID],
			},
		]);
		assert.deepEqual(
			network.backends.map(({ id }) => id),
			[OLDER_BACKEND_ID, NEWER_BACKEND_ID]
		);
	});

	it('takes only the exposure lock when the exposure has no live backend', async () => {
		const store = new NetworkStore();
		store.backends.length = 0;

		const network = await lockExposureNetwork(store.asEntityManager(), [
			EXPOSURE_ID,
		]);

		assert.deepEqual(store.locks, [
			{ table: 'sandbox_exposure', ids: [EXPOSURE_ID] },
		]);
		assert.deepEqual(network.backends, []);
	});
});
