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
import { fakeInstance } from '../../../common/testing/instance.fake';
import { Snapshot } from '../../../snapshot/entities/snapshot.entity';
import { MachineSnapshotTarget } from '../../entities/machine-snapshot-target.entity';
import { MachineSnapshotTargetReason } from '../../enums/machine-snapshot-target-reason.enum';
import { MachineDesiredStateRevisionService } from './machine-desired-state-revision.service';
import { MachineSnapshotTargetService } from './machine-snapshot-target.service';

const DELETED_REF = 'registry.example.com/snapflow/deleted:1.0';
const SHARED_REF = 'registry.example.com/snapflow/shared:1.0';
const FIRST_MACHINE_ID = '1a000000-0000-4000-8000-000000000001';
const SECOND_MACHINE_ID = '2b000000-0000-4000-8000-000000000002';

interface TargetRow {
	id: string;
	machineId: string;
	snapshotRef: string;
}

function manager(
	targets: TargetRow[],
	activeRefs: string[],
	inserted: boolean
) {
	const deleted: string[] = [];
	const fake = fakeInstance(EntityManager, {
		find: async (
			entity: unknown,
			where: { snapshotRef?: { $in: string[] } }
		) => {
			if (entity === Snapshot) {
				return activeRefs.map((ref) => ({ ref }));
			}
			const refs = where.snapshotRef?.$in ?? [];
			return targets.filter(({ snapshotRef }) => refs.includes(snapshotRef));
		},
		nativeDelete: async (entity: unknown, where: { id: { $in: string[] } }) => {
			assert.equal(entity, MachineSnapshotTarget);
			deleted.push(...where.id.$in);
			return where.id.$in.length;
		},
		execute: async () => (inserted ? [{ id: 'target' }] : []),
	});
	return { manager: fake, deleted };
}

function service() {
	const revisions = fakeInstance(MachineDesiredStateRevisionService);
	const advance = mock.method(revisions, 'advance', async () => undefined);
	return { targets: new MachineSnapshotTargetService(revisions), advance };
}

describe('MachineSnapshotTargetService', () => {
	it('stops targeting machines with a snapshot no active snapshot uses', async () => {
		const { targets, advance } = service();
		const fake = manager(
			[
				{
					id: 'deleted-1',
					machineId: FIRST_MACHINE_ID,
					snapshotRef: DELETED_REF,
				},
				{
					id: 'deleted-2',
					machineId: SECOND_MACHINE_ID,
					snapshotRef: DELETED_REF,
				},
				{
					id: 'shared-1',
					machineId: FIRST_MACHINE_ID,
					snapshotRef: SHARED_REF,
				},
			],
			[SHARED_REF],
			false
		);

		const removed = await targets.removeInactivePropagation(fake.manager, [
			DELETED_REF,
			SHARED_REF,
			DELETED_REF,
		]);

		assert.equal(removed, 2);
		assert.deepEqual(fake.deleted, ['deleted-1', 'deleted-2']);
		assert.deepEqual(advance.mock.calls[0]?.arguments[1], [
			FIRST_MACHINE_ID,
			SECOND_MACHINE_ID,
		]);
	});

	it('advances the revision only when a target is added', async () => {
		const { targets, advance } = service();

		await targets.add(
			manager([], [], false).manager,
			FIRST_MACHINE_ID,
			SHARED_REF,
			MachineSnapshotTargetReason.PROPAGATION,
			null
		);
		assert.equal(advance.mock.callCount(), 0);

		await targets.add(
			manager([], [], true).manager,
			FIRST_MACHINE_ID,
			SHARED_REF,
			MachineSnapshotTargetReason.PROPAGATION,
			null
		);
		assert.deepEqual(advance.mock.calls[0]?.arguments[1], [FIRST_MACHINE_ID]);
	});
});
