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
import { create, type JsonObject, toJson } from '@bufbuild/protobuf';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	type DesiredSnapshot,
	SandboxBackupSourceSchema,
	SandboxImageSchema,
	SandboxSpecSchema,
	SnapshotRetention,
} from '@snapflow/machine-proto';
import { fakeInstance } from '../../../../common/testing/instance.fake';
import { DockerRegistry } from '../../../../docker-registry/persistence/entities/docker-registry.entity';
import { RegistryType } from '../../../../docker-registry/persistence/enums/registry-type.enum';
import { DockerRegistryService } from '../../../../docker-registry/registry/services/docker-registry.service';
import { Sandbox } from '../../../instance/entities/sandbox.entity';
import { Snapshot } from '../../../snapshot/entities/snapshot.entity';
import { SnapshotState } from '../../../snapshot/enums/snapshot-state.enum';
import { MACHINE_QUALIFICATION_CANARY_SNAPSHOT } from '../../constants/machine-qualification.constants';
import { MachineSnapshotTarget } from '../../entities/machine-snapshot-target.entity';
import { MachineSnapshotTargetReason } from '../../enums/machine-snapshot-target-reason.enum';
import { DesiredSnapshotSetService } from './desired-snapshot-set.service';

const MACHINE = { id: '1a000000-0000-4000-8000-000000000001' };
const IMAGE_REF = 'registry.example.com/snapflow/base:1.0';
const BACKUP_REF = 'registry.example.com/backups/sandbox:1';
const BUILD_REF = 'snapflow-build:snapflow';
const PROPAGATED_REF = 'registry.example.com/snapflow/propagated:1.0';
const CANARY_REF = MACHINE_QUALIFICATION_CANARY_SNAPSHOT;
const BUILDER_REF = 'moby/buildkit:v0.31.1';
const INTERNAL_REGISTRY_ID = '5e4d3c2b-1a09-4f8e-9d7c-6b5a4f3e2d1c';
const BACKUP_REGISTRY_ID = '8c7b6a59-4e3d-4c2b-9a18-0f9e8d7c6b5a';
const IMAGE_DIGEST = `sha256:${'a'.repeat(64)}`;
const INTERNAL_REGISTRY_URL = 'https://registry.example.com';
const SNAPSHOT_CPU = 2;

function spec(source: 'image' | 'backup', ref: string): JsonObject {
	const specification = create(SandboxSpecSchema, {
		source:
			source === 'image'
				? { case: 'image', value: create(SandboxImageSchema, { ref }) }
				: { case: 'backup', value: create(SandboxBackupSourceSchema, { ref }) },
	});
	const json = toJson(SandboxSpecSchema, specification);
	assert.ok(json !== null && typeof json === 'object' && !Array.isArray(json));
	return json;
}

function registryIdOf(
	snapshot: DesiredSnapshot | undefined
): string | undefined {
	return snapshot?.source.case === 'registry'
		? snapshot.source.value.registryId
		: undefined;
}

function manager(rows: Map<unknown, unknown[]>): EntityManager {
	return fakeInstance(EntityManager, {
		find: async (entity: unknown) => rows.get(entity) ?? [],
	});
}

function service() {
	const registries = fakeInstance(DockerRegistryService);
	const internalRegistries = mock.method(
		registries,
		'internalRegistries',
		async () => [
			fakeInstance(DockerRegistry, {
				id: INTERNAL_REGISTRY_ID,
				url: INTERNAL_REGISTRY_URL,
				registryType: RegistryType.INTERNAL,
			}),
		]
	);
	return {
		desiredSnapshots: new DesiredSnapshotSetService(registries),
		internalRegistries,
	};
}

describe('DesiredSnapshotSetService', () => {
	it('desires the snapshots of hosted sandboxes, targets and the canary', async () => {
		const sandboxes = [
			fakeInstance(Sandbox, {
				runtimeSpec: spec('image', IMAGE_REF),
				runtimeRegistryId: INTERNAL_REGISTRY_ID,
			}),
			fakeInstance(Sandbox, {
				runtimeSpec: spec('backup', BACKUP_REF),
				runtimeRegistryId: BACKUP_REGISTRY_ID,
			}),
			fakeInstance(Sandbox, {
				runtimeSpec: spec('image', BUILD_REF),
				runtimeRegistryId: null,
			}),
		];
		const rows = new Map<unknown, unknown[]>([
			[
				MachineSnapshotTarget,
				[
					{
						snapshotRef: PROPAGATED_REF,
						reason: MachineSnapshotTargetReason.PROPAGATION,
						template: null,
					},
				],
			],
			[
				Snapshot,
				[
					{
						ref: IMAGE_REF,
						digest: IMAGE_DIGEST,
						state: SnapshotState.ACTIVE,
						cpu: SNAPSHOT_CPU,
						mem: 4,
						disk: 10,
					},
				],
			],
		]);

		const snapshots = await service().desiredSnapshots.forMachine(
			manager(rows),
			MACHINE,
			sandboxes
		);

		assert.deepEqual(
			snapshots.map(({ ref }) => ref),
			[CANARY_REF, BACKUP_REF, IMAGE_REF, PROPAGATED_REF, BUILD_REF]
		);
		const byRef = new Map(
			snapshots.map((snapshot) => [snapshot.ref, snapshot])
		);
		assert.equal(byRef.get(CANARY_REF)?.source.case, 'registry');
		assert.equal(registryIdOf(byRef.get(CANARY_REF)), undefined);
		assert.equal(registryIdOf(byRef.get(BACKUP_REF)), BACKUP_REGISTRY_ID);
		assert.equal(byRef.get(BUILD_REF)?.source.case, 'local');
		assert.equal(byRef.get(IMAGE_REF)?.digest, IMAGE_DIGEST);
		assert.equal(byRef.get(IMAGE_REF)?.template?.cpuQuota, SNAPSHOT_CPU);
		assert.equal(registryIdOf(byRef.get(PROPAGATED_REF)), INTERNAL_REGISTRY_ID);
	});

	it('keeps a declarative build cache local with its template', async () => {
		const template = {
			cpuQuota: 4,
			memoryQuota: 8,
			storageQuota: 20,
			capabilities: [],
		};
		const rows = new Map<unknown, unknown[]>([
			[
				MachineSnapshotTarget,
				[
					{
						snapshotRef: BUILD_REF,
						reason: MachineSnapshotTargetReason.BUILD_CACHE,
						template,
					},
				],
			],
		]);

		const { desiredSnapshots, internalRegistries } = service();
		const snapshots = await desiredSnapshots.forMachine(
			manager(rows),
			MACHINE,
			[]
		);

		assert.equal(internalRegistries.mock.callCount(), 0);
		const build = snapshots.find(({ ref }) => ref === BUILD_REF);
		assert.equal(build?.source.case, 'local');
		assert.equal(build?.template?.storageQuota, template.storageQuota);
	});

	it('pre-warms the default snapshot and the public builder image', async () => {
		const rows = new Map<unknown, unknown[]>([
			[
				MachineSnapshotTarget,
				[
					{
						snapshotRef: IMAGE_REF,
						reason: MachineSnapshotTargetReason.PREWARM,
						template: null,
					},
					{
						snapshotRef: BUILDER_REF,
						reason: MachineSnapshotTargetReason.PREWARM,
						template: null,
					},
					{
						snapshotRef: PROPAGATED_REF,
						reason: MachineSnapshotTargetReason.PREWARM,
						template: null,
					},
					{
						snapshotRef: PROPAGATED_REF,
						reason: MachineSnapshotTargetReason.PROPAGATION,
						template: null,
					},
				],
			],
		]);

		const { desiredSnapshots, internalRegistries } = service();
		const snapshots = await desiredSnapshots.forMachine(
			manager(rows),
			MACHINE,
			[]
		);

		assert.equal(internalRegistries.mock.callCount(), 1);

		const byRef = new Map(
			snapshots.map((snapshot) => [snapshot.ref, snapshot])
		);
		assert.equal(byRef.get(IMAGE_REF)?.retention, SnapshotRetention.PREWARM);
		assert.equal(registryIdOf(byRef.get(IMAGE_REF)), INTERNAL_REGISTRY_ID);
		assert.equal(byRef.get(BUILDER_REF)?.retention, SnapshotRetention.PREWARM);
		assert.equal(byRef.get(BUILDER_REF)?.source.case, 'registry');
		assert.equal(registryIdOf(byRef.get(BUILDER_REF)), undefined);
		assert.equal(
			byRef.get(PROPAGATED_REF)?.retention,
			SnapshotRetention.REQUIRED
		);
		assert.equal(byRef.get(CANARY_REF)?.retention, SnapshotRetention.REQUIRED);
	});
});
