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
import { fakeSettings } from '../../../settings/platform/testing/settings.fake';
import { SandboxClass } from '../../instance/enums/sandbox-class.enum';
import { Machine } from '../../machine/entities/machine.entity';
import { MachineSnapshotTarget } from '../../machine/entities/machine-snapshot-target.entity';
import { MachineSnapshotTargetReason } from '../../machine/enums/machine-snapshot-target-reason.enum';
import { MachineState } from '../../machine/enums/machine-state.enum';
import { MachineSnapshotTargetService } from '../../machine/services/desired-state/machine-snapshot-target.service';
import { Snapshot } from '../entities/snapshot.entity';
import { SnapshotPrewarmService } from './snapshot-prewarm.service';

const MACHINE_ID = '1a000000-0000-4000-8000-000000000001';
const DEFAULT_SNAPSHOT_NAME = 'ubuntu:24.04';
const DEFAULT_REF = 'registry.example.com/snapflow/snapflow-abc:snapflow';
const BUILDER_REF = 'moby/buildkit:v0.31.1';
const STALE_REF = 'registry.example.com/snapflow/snapflow-old:snapflow';
const STALE_TARGET_ID = 'stale-target';
const SNAPSHOT_CPU = 2;

interface Fixture {
	state?: MachineState;
	targets?: { id: string; snapshotRef: string }[];
	defaultSnapshotActive?: boolean;
}

function prewarm({
	state = MachineState.READY,
	targets = [],
	defaultSnapshotActive = true,
}: Fixture) {
	const machine = {
		id: MACHINE_ID,
		state,
		sandboxClass: SandboxClass.LINUX_VM,
		runtimeCapabilities: { builderImage: BUILDER_REF },
		gpuCount: 0,
		gpuType: null,
	};
	const snapshot = {
		id: 'snapshot',
		ref: DEFAULT_REF,
		gpu: 0,
		gpuType: null,
		sandboxClass: SandboxClass.LINUX_VM,
		cpu: SNAPSHOT_CPU,
		mem: 4,
		disk: 10,
	};
	const fake: EntityManager = fakeInstance(EntityManager, {
		findOneOrFail: async (entity: unknown) => {
			assert.equal(entity, Machine);
			return machine;
		},
		find: async (entity: unknown) => {
			assert.equal(entity, MachineSnapshotTarget);
			return targets;
		},
		findOne: async (entity: unknown) => {
			if (entity === Machine) return machine;
			assert.equal(entity, Snapshot);
			return defaultSnapshotActive ? snapshot : null;
		},
		transactional: async (work: (manager: unknown) => Promise<void>) =>
			work(fake),
	});
	const targetService = fakeInstance(MachineSnapshotTargetService);
	const add = mock.method(targetService, 'add', async () => undefined);
	const remove = mock.method(targetService, 'remove', async () => 1);
	const service = new SnapshotPrewarmService(
		fake,
		targetService,
		fakeSettings({ defaultSnapshot: DEFAULT_SNAPSHOT_NAME })
	);
	return { service, add, remove };
}

describe('SnapshotPrewarmService', () => {
	it('targets a ready machine with the default snapshot and its builder', async () => {
		const { service, add, remove } = prewarm({});

		await service.reconcile(MACHINE_ID);

		const added = new Map(
			add.mock.calls.map(({ arguments: [, , ref, reason, template] }) => [
				ref,
				{ reason, template },
			])
		);
		assert.deepEqual([...added.keys()].sort(), [BUILDER_REF, DEFAULT_REF]);
		assert.equal(
			added.get(DEFAULT_REF)?.reason,
			MachineSnapshotTargetReason.PREWARM
		);
		assert.equal(added.get(DEFAULT_REF)?.template?.cpuQuota, SNAPSHOT_CPU);
		assert.equal(added.get(BUILDER_REF)?.template, null);
		assert.equal(remove.mock.callCount(), 0);
	});

	it('changes nothing once the machine is pre-warmed', async () => {
		const { service, add, remove } = prewarm({
			targets: [
				{ id: 'builder', snapshotRef: BUILDER_REF },
				{ id: 'default', snapshotRef: DEFAULT_REF },
			],
		});

		await service.reconcile(MACHINE_ID);

		assert.equal(add.mock.callCount(), 0);
		assert.equal(remove.mock.callCount(), 0);
	});

	it('replaces a stale pre-warm and skips a default snapshot that is not active', async () => {
		const { service, add, remove } = prewarm({
			targets: [{ id: STALE_TARGET_ID, snapshotRef: STALE_REF }],
			defaultSnapshotActive: false,
		});

		await service.reconcile(MACHINE_ID);

		assert.deepEqual(
			add.mock.calls.map(({ arguments: [, , ref] }) => ref),
			[BUILDER_REF]
		);
		assert.deepEqual(remove.mock.calls[0]?.arguments[1], {
			id: { $in: [STALE_TARGET_ID] },
		});
	});

	it('stops pre-warming a draining machine', async () => {
		const { service, add, remove } = prewarm({
			state: MachineState.DRAINING,
			targets: [{ id: 'builder', snapshotRef: BUILDER_REF }],
		});

		await service.reconcile(MACHINE_ID);

		assert.equal(add.mock.callCount(), 0);
		assert.deepEqual(remove.mock.calls[0]?.arguments[1], {
			id: { $in: ['builder'] },
		});
	});
});
