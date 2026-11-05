/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { EntityManager } from '@mikro-orm/postgresql';
import { fakeInstance } from '../../common/testing/instance.fake';
import { Machine } from '../../machine/entities/machine.entity';
import { MachineSnapshotTargetReason } from '../../machine/enums/machine-snapshot-target-reason.enum';
import { MachineSnapshotTargetService } from '../../machine/services/desired-state/machine-snapshot-target.service';
import { Snapshot } from '../entities/snapshot.entity';
import { SnapshotMachine } from '../entities/snapshot-machine.entity';
import { SnapshotState } from '../enums/snapshot-state.enum';
import { SnapshotRepository } from '../repositories/snapshot.repository';
import { SnapshotActivationService } from './snapshot-activation.service';

const REF = 'registry.example.com/snapflow/base:1.0';
const SNAPSHOT_SIZE_GB = 1.5;
const MACHINE = fakeInstance(Machine, {
	id: '1a000000-0000-4000-8000-000000000001',
});

function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
	return Object.assign(new Snapshot(), {
		id: 'snapshot-1',
		ref: REF,
		state: SnapshotState.PULLING,
		size: SNAPSHOT_SIZE_GB,
		cpu: 1,
		mem: 2,
		disk: 5,
		...overrides,
	});
}

interface Fixture {
	snapshots: Snapshot[];
	holders: Machine[];
}

function activation(fixture: Fixture) {
	const entityManager: EntityManager = fakeInstance(EntityManager, {
		find: async (entity: unknown) => {
			if (entity === Snapshot) return fixture.snapshots;
			if (entity === SnapshotMachine) {
				return fixture.holders.map(({ id }) => ({ machineId: id }));
			}
			return fixture.holders;
		},
		transactional: async (work: (manager: EntityManager) => Promise<unknown>) =>
			work(entityManager),
	});
	const repository = fakeInstance(SnapshotRepository);
	const update = mock.method(
		repository,
		'update',
		async (
			id: string,
			params: { updateData: Partial<Snapshot>; entity?: Snapshot }
		) => {
			Object.assign(params.entity ?? {}, params.updateData);
			return params.entity ?? snapshot({ id });
		}
	);
	const targets = fakeInstance(MachineSnapshotTargetService);
	const add = mock.method(targets, 'add', async () => undefined);
	const service = new SnapshotActivationService(
		entityManager,
		repository,
		targets
	);
	return { service, update, add };
}

describe('SnapshotActivationService', () => {
	it('activates a snapshot once a machine reports holding it', async () => {
		const pulling = snapshot();
		const { service, update, add } = activation({
			snapshots: [pulling],
			holders: [MACHINE],
		});

		await service.activateHeldBy(MACHINE, [REF]);

		assert.equal(update.mock.callCount(), 1);
		assert.equal(pulling.state, SnapshotState.ACTIVE);
		assert.deepEqual(add.mock.calls[0]?.arguments.slice(1, 4), [
			MACHINE.id,
			REF,
			MachineSnapshotTargetReason.PROPAGATION,
		]);
	});

	it('waits for the published size before activating', async () => {
		const { service, update } = activation({
			snapshots: [snapshot({ size: null })],
			holders: [MACHINE],
		});

		await service.activateHeldBy(MACHINE, [REF]);

		assert.equal(update.mock.callCount(), 0);
	});

	it('activates from the observed inventory of any holder', async () => {
		const building = snapshot({ state: SnapshotState.BUILDING });
		const { service } = activation({
			snapshots: [],
			holders: [MACHINE],
		});

		await service.activateIfHeld(building);

		assert.equal(building.state, SnapshotState.ACTIVE);
	});

	it('never activates a snapshot that is no longer being created', async () => {
		const { service, update } = activation({
			snapshots: [],
			holders: [MACHINE],
		});

		await service.activateIfHeld(snapshot({ state: SnapshotState.ERROR }));

		assert.equal(update.mock.callCount(), 0);
	});
});
