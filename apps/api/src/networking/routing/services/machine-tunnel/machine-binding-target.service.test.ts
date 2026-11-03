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
import { fakeInstance } from '../../../../common/testing/instance.fake';
import { NO_KEY_UPDATE_LOCK } from '../../../../infra/database/utils/row-lock.util';
import { Machine } from '../../../../sandbox/machine/entities/machine.entity';
import {
	EXPOSURE_BACKEND_STATE,
	EXPOSURE_TARGET_HOST,
	SYSTEM_EXPOSURE_SERVICE,
} from '../../constants/exposure.constants';
import {
	MACHINE_EDGE_BINDING_DESIRED_STATE,
	MACHINE_EDGE_BINDING_STATE,
} from '../../constants/machine-tunnel.constants';
import { NETWORK_PROTOCOL } from '../../constants/networking.constants';
import { Edge } from '../../entities/edge.entity';
import { Exposure } from '../../entities/exposure.entity';
import { ExposureBackend } from '../../entities/exposure-backend.entity';
import { MachineEdgeBinding } from '../../entities/machine-edge-binding.entity';
import { machineTargetPlanDigest } from '../../utils/machine-tunnel/machine-binding-digest.util';
import { machineTunnelTargetDto } from '../../utils/machine-tunnel/machine-tunnel-target.util';
import { NetworkControlVersionService } from '../network-control-version.service';
import { MachineBindingTargetService } from './machine-binding-target.service';

const UUID_ID_PROPERTIES = { id: { columnTypes: ['uuid'] } };

const SHARED_BINDING_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const EMPTIED_BINDING_ID = '2b3c4d5e-6f70-4b8c-9d0e-1f2a3b4c5d6e';
const RETAINED_BACKEND_ID = '3c4d5e6f-7081-4c9d-8e1f-2a3b4c5d6e7f';
const EXPOSURE_ID = '4d5e6f70-8192-4dae-9f20-3b4c5d6e7f80';
const LAPSED_BACKEND_ID = '5e6f7081-92a3-4ebf-8031-4c5d6e7f8091';
const MACHINE_ID = '6f708192-a3b4-4fc0-9142-5d6e7f8091a2';
const EDGE_ID = '708192a3-b4c5-40d1-a253-6e7f8091a2b3';
const BINDING_REVISION = 1;
const INITIAL_TARGET_REVISION = 3;
const STALE_DIGEST = 'f'.repeat(64);
const FENCING_TOKEN_HASH = 'e'.repeat(64);
const TARGET_PORT = 2_280;
const OBSERVED_AT = new Date('2026-10-04T05:30:15.000Z');
const LEASE_EXPIRES_AT = new Date('2026-10-04T05:35:15.000Z');
const LOCK_ORDER = [
	{ table: 'machine', ids: [MACHINE_ID] },
	{ table: 'network_edge', ids: [EDGE_ID] },
	{ table: 'machine_edge_binding', ids: [SHARED_BINDING_ID] },
	{ table: 'sandbox_exposure_backend', ids: [LAPSED_BACKEND_ID] },
];

function binding(id: string): MachineEdgeBinding {
	return Object.assign(new MachineEdgeBinding(), {
		id,
		revision: BINDING_REVISION,
		targetRevision: INITIAL_TARGET_REVISION,
		targetDigest: STALE_DIGEST,
		desiredState: MACHINE_EDGE_BINDING_DESIRED_STATE.ACTIVE,
		observedState: MACHINE_EDGE_BINDING_STATE.ACTIVE,
		releasedAt: null,
	});
}

function retainedBackend(): ExposureBackend {
	return Object.assign(new ExposureBackend(), {
		id: RETAINED_BACKEND_ID,
		bindingId: SHARED_BINDING_ID,
		exposureId: EXPOSURE_ID,
		exposureGeneration: 1,
		sandboxId: 'sandbox-still-running',
		assignmentGeneration: 1,
		placementFencingTokenHash: FENCING_TOKEN_HASH,
		protocol: NETWORK_PROTOCOL.HTTP,
		targetPort: TARGET_PORT,
		state: EXPOSURE_BACKEND_STATE.ACTIVE,
		leaseExpiresAt: LEASE_EXPIRES_AT,
		targetRevision: INITIAL_TARGET_REVISION,
		targetDigest: STALE_DIGEST,
		machineAcknowledgedAt: OBSERVED_AT,
	});
}

function exposure(): Exposure {
	return Object.assign(new Exposure(), {
		id: EXPOSURE_ID,
		systemService: SYSTEM_EXPOSURE_SERVICE.TOOLBOX,
		targetHost: EXPOSURE_TARGET_HOST.RUNTIME,
		targetReference: null,
	});
}

const TABLE_BY_ENTITY = new Map<unknown, string>([
	[Machine, 'machine'],
	[Edge, 'network_edge'],
	[MachineEdgeBinding, 'machine_edge_binding'],
	[ExposureBackend, 'sandbox_exposure_backend'],
]);
const LOCKED_TABLE_PATTERN = /FROM "(\w+)"/;

interface StoreFilter {
	readonly $and?: readonly { id: { $in: string[] } }[];
	readonly leaseExpiresAt?: unknown;
}

function reloadedIds(filter: StoreFilter): string[] | null {
	const [byId] = filter.$and ?? [];
	return byId?.id.$in ?? null;
}

class BindingStore {
	readonly locks: { table: string; ids: string[] }[] = [];

	constructor(
		readonly bindings: MachineEdgeBinding[],
		readonly remaining: ExposureBackend[],
		readonly lapsed: ExposureBackend[] = []
	) {}

	async find(entity: unknown, filter: StoreFilter): Promise<unknown[]> {
		const ids = reloadedIds(filter);
		if (entity === MachineEdgeBinding) {
			return this.bindings.filter(({ id }) => !ids || ids.includes(id));
		}
		if (entity === ExposureBackend) {
			if (ids) {
				return [...this.lapsed, ...this.remaining].filter(({ id }) =>
					ids.includes(id)
				);
			}
			return 'leaseExpiresAt' in filter ? this.lapsed : this.remaining;
		}
		if (entity === Exposure) return [exposure()];
		if (entity === Machine || entity === Edge) return [];
		throw new Error('Unexpected entity lookup');
	}

	async execute(
		sql: string,
		parameters: unknown[] = []
	): Promise<{ now: Date }[]> {
		if (sql.includes(NO_KEY_UPDATE_LOCK)) {
			const [ids] = parameters;
			assert.ok(Array.isArray(ids));
			const table = LOCKED_TABLE_PATTERN.exec(sql)?.[1];
			assert.ok(table);
			this.locks.push({ table, ids: ids.map(String) });
		}
		return [{ now: OBSERVED_AT }];
	}

	getMetadata(entity: unknown) {
		const tableName = TABLE_BY_ENTITY.get(entity);
		assert.ok(tableName);
		return { tableName, primaryKeys: ['id'], properties: UUID_ID_PROPERTIES };
	}

	getPlatform(): { quoteIdentifier: (name: string) => string } {
		return { quoteIdentifier: (name) => `"${name}"` };
	}

	async flush(): Promise<void> {}

	async transactional<Result>(
		work: (manager: EntityManager) => Promise<Result>
	): Promise<Result> {
		return work(this.asEntityManager());
	}

	private readonly entityManager = fakeInstance(EntityManager, {
		find: this.find.bind(this),
		execute: this.execute.bind(this),
		getMetadata: this.getMetadata.bind(this),
		getPlatform: this.getPlatform.bind(this),
		flush: this.flush.bind(this),
		transactional: this.transactional.bind(this),
	});

	asEntityManager(): EntityManager {
		return this.entityManager;
	}
}

type VersionBump = Parameters<NetworkControlVersionService['bumpEdges']>;
const BUMPED_IDS_ARGUMENT = 1;

class RecordingVersions {
	readonly bumpedEdges: string[] = [];
	readonly bumpedMachines: string[] = [];

	async bumpEdges(...bump: VersionBump): Promise<void> {
		this.bumpedEdges.push(...bump[BUMPED_IDS_ARGUMENT]);
	}

	async bumpMachines(...bump: VersionBump): Promise<void> {
		this.bumpedMachines.push(...bump[BUMPED_IDS_ARGUMENT]);
	}

	asService(): NetworkControlVersionService {
		return fakeInstance(NetworkControlVersionService, {
			bumpEdges: this.bumpEdges.bind(this),
			bumpMachines: this.bumpMachines.bind(this),
		});
	}
}

function service(
	store: BindingStore,
	versions = new RecordingVersions()
): MachineBindingTargetService {
	return new MachineBindingTargetService(
		store.asEntityManager(),
		versions.asService()
	);
}

describe('MachineBindingTargetService', () => {
	it('releases lapsed backends after locking their Machine, Edge and binding', async () => {
		const shared = binding(SHARED_BINDING_ID);
		const retained = retainedBackend();
		const lapsed = Object.assign(retainedBackend(), {
			id: LAPSED_BACKEND_ID,
			edgeId: EDGE_ID,
			leaseExpiresAt: OBSERVED_AT,
		});
		const store = new BindingStore([shared], [retained], [lapsed]);
		const versions = new RecordingVersions();

		await service(store, versions).releaseLapsed(MACHINE_ID);

		assert.equal(lapsed.state, EXPOSURE_BACKEND_STATE.RELEASED);
		assert.equal(lapsed.releasedAt, OBSERVED_AT);
		assert.deepEqual(store.locks.slice(0, LOCK_ORDER.length), LOCK_ORDER);
		assert.equal(shared.targetRevision, INITIAL_TARGET_REVISION + 1);
		assert.equal(
			shared.targetDigest,
			machineTargetPlanDigest(
				SHARED_BINDING_ID,
				BINDING_REVISION,
				INITIAL_TARGET_REVISION + 1,
				[machineTunnelTargetDto(retained, exposure())]
			)
		);
		assert.deepEqual(versions.bumpedEdges, [EDGE_ID]);
		assert.deepEqual(versions.bumpedMachines, [MACHINE_ID]);
	});

	it('takes no lock and re-issues nothing when no lease lapsed', async () => {
		const store = new BindingStore([binding(SHARED_BINDING_ID)], []);
		const versions = new RecordingVersions();

		await service(store, versions).releaseLapsed(MACHINE_ID);

		assert.deepEqual(store.locks, []);
		assert.deepEqual(versions.bumpedMachines, []);
	});

	it('re-fences a shared binding after another sandbox released its backend', async () => {
		const shared = binding(SHARED_BINDING_ID);
		const backend = retainedBackend();
		const store = new BindingStore([shared], [backend]);

		await service(store).reviseOrRelease(
			store.asEntityManager(),
			[SHARED_BINDING_ID, SHARED_BINDING_ID],
			OBSERVED_AT
		);

		const expectedDigest = machineTargetPlanDigest(
			SHARED_BINDING_ID,
			BINDING_REVISION,
			INITIAL_TARGET_REVISION + 1,
			[machineTunnelTargetDto(backend, exposure())]
		);
		assert.equal(shared.targetRevision, INITIAL_TARGET_REVISION + 1);
		assert.equal(shared.targetDigest, expectedDigest);
		assert.equal(shared.observedState, MACHINE_EDGE_BINDING_STATE.ACTIVE);
		assert.equal(backend.targetDigest, expectedDigest);
		assert.equal(backend.machineAcknowledgedAt, null);
	});

	it('releases a binding that no longer carries any backend', async () => {
		const emptied = binding(EMPTIED_BINDING_ID);
		const store = new BindingStore([emptied], []);

		await service(store).reviseOrRelease(
			store.asEntityManager(),
			[EMPTIED_BINDING_ID],
			OBSERVED_AT
		);

		assert.equal(emptied.observedState, MACHINE_EDGE_BINDING_STATE.RELEASED);
		assert.equal(
			emptied.desiredState,
			MACHINE_EDGE_BINDING_DESIRED_STATE.RELEASED
		);
		assert.equal(emptied.releasedAt, OBSERVED_AT);
	});

	it('leaves a binding whose fence already matches its targets untouched', async () => {
		const shared = binding(SHARED_BINDING_ID);
		const backend = retainedBackend();
		shared.targetDigest = machineTargetPlanDigest(
			SHARED_BINDING_ID,
			BINDING_REVISION,
			INITIAL_TARGET_REVISION,
			[machineTunnelTargetDto(backend, exposure())]
		);
		const store = new BindingStore([shared], [backend]);

		await service(store).reviseOrRelease(
			store.asEntityManager(),
			[SHARED_BINDING_ID],
			OBSERVED_AT
		);

		assert.equal(shared.targetRevision, INITIAL_TARGET_REVISION);
		assert.equal(backend.machineAcknowledgedAt, OBSERVED_AT);
	});
});
