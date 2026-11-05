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
import type { Registry } from '@snapflow/machine-proto';
import { fakeInstance } from '../../../common/testing/instance.fake';
import { REGISTRY_TOKEN } from '../../../docker-registry/constants/registry-token.constants';
import { DockerRegistry } from '../../../docker-registry/persistence/entities/docker-registry.entity';
import { RegistryType } from '../../../docker-registry/persistence/enums/registry-type.enum';
import { fakeRegistryTokens } from '../../../docker-registry/testing/registry-token-signer.fake';
import { ObjectStorageService } from '../../../object-storage/services/object-storage.service';
import { SandboxPlacement } from '../../entities/sandbox-placement.entity';
import { Machine } from '../../machine/entities/machine.entity';
import { BuildInfo } from '../../snapshot/entities/build-info.entity';
import { Job } from '../entities/job.entity';
import { JobService } from './job.service';
import { MachineJobDispatchService } from './machine-job-dispatch.service';

const MACHINE_ID = '1a000000-0000-4000-8000-000000000001';
const SANDBOX_ID = '2b000000-0000-4000-8000-000000000002';
const ORGANIZATION_ID = '7f9c2a4e-5b1d-4c3a-9e8f-1a2b3c4d5e6f';
const SNAPSHOT_REF = 'localhost:5001/snapflow/snapshot-abc:v1';
const ASSIGNMENT_GENERATION = 3;

type RegistryPayload = Partial<Pick<Registry, 'username' | 'password'>>;

function setup() {
	const registryTokens = fakeRegistryTokens();
	const jobs = fakeInstance(JobService);
	const createJob = mock.method(jobs, 'createJob', async () =>
		Object.assign(new Job(), { id: 'job-1' })
	);
	const storage = fakeInstance(ObjectStorageService);
	mock.method(storage, 'getBuildContextDownloads', async () => []);
	mock.method(storage, 'createBuildLogUpload', async () => ({
		uploadUrl: 'https://storage.invalid/log',
	}));
	const entityManager = fakeInstance(EntityManager);
	mock.method(entityManager, 'findOne', async () =>
		Object.assign(new SandboxPlacement(), {
			assignmentGeneration: ASSIGNMENT_GENERATION,
		})
	);
	const dispatch = new MachineJobDispatchService(
		entityManager,
		jobs,
		storage,
		registryTokens.tokens
	);
	const machine = Object.assign(new Machine(), { id: MACHINE_ID });
	const payload = (): Record<string, unknown> =>
		JSON.parse(String(createJob.mock.calls.at(-1)?.arguments[5]));
	return { ...registryTokens, dispatch, machine, payload };
}

describe('MachineJobDispatchService registry tokens', () => {
	it('scopes a sandbox snapshot push to the snapshot repository for the machine', async () => {
		const { dispatch, machine, payload, snapshotManager, verify } = setup();

		await dispatch.createSnapshotFromSandbox(
			machine,
			SANDBOX_ID,
			SNAPSHOT_REF,
			snapshotManager.internal()
		);

		const registry = payload().registry as RegistryPayload;
		assert.equal(registry.username, REGISTRY_TOKEN.USERNAME);
		const claims = await verify(String(registry.password));
		assert.equal(claims.sub, `machine:${MACHINE_ID}`);
		assert.deepEqual(claims.access, [
			{
				type: 'repository',
				name: 'snapflow/snapshot-abc',
				actions: ['pull', 'push'],
			},
		]);
	});

	it('gives a build its cache namespace and the mirror, nothing else', async () => {
		const { dispatch, machine, payload, snapshotManager, verify } = setup();
		const cacheRegistry = {
			...snapshotManager.transient(),
			project: `transient/${ORGANIZATION_ID}/buildcache`,
		};
		const buildInfo = Object.assign(new BuildInfo(), {
			snapshotRef: SNAPSHOT_REF,
			contextHashes: [],
		});

		await dispatch.buildSnapshot(
			machine,
			buildInfo,
			ORGANIZATION_ID,
			cacheRegistry
		);

		const cache = payload().cacheRegistry as RegistryPayload;
		const claims = await verify(String(cache.password));
		assert.deepEqual(claims.access, [
			{
				type: 'repository',
				name: `transient/${ORGANIZATION_ID}/buildcache/*`,
				actions: ['pull', 'push'],
			},
			{ type: 'repository', name: 'mirror/docker.io/*', actions: ['pull'] },
		]);
	});

	it('leaves credentials of registries the platform does not run untouched', async () => {
		const { dispatch, machine, payload } = setup();
		const external = Object.assign(new DockerRegistry(), {
			id: 'external-registry',
			url: 'https://registry.example.com',
			username: 'customer',
			password: 'customer-secret',
			project: 'team',
			registryType: RegistryType.ORGANIZATION,
		});

		await dispatch.createSnapshotFromSandbox(
			machine,
			SANDBOX_ID,
			'registry.example.com/team/app:v1',
			external
		);

		assert.deepEqual(payload().registry, {
			url: 'https://registry.example.com',
			username: 'customer',
			password: 'customer-secret',
			project: 'team',
		});
	});
});
