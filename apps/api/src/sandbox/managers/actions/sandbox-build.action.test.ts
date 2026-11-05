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
import { DockerRegistry } from '../../../docker-registry/persistence/entities/docker-registry.entity';
import { DockerRegistryService } from '../../../docker-registry/services/docker-registry.service';
import { Sandbox } from '../../entities/sandbox.entity';
import { PlacementLocality } from '../../enums/placement-locality.enum';
import { SandboxMode } from '../../enums/sandbox-mode.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { Machine } from '../../machine/entities/machine.entity';
import { MachineSnapshotTargetReason } from '../../machine/enums/machine-snapshot-target-reason.enum';
import { MachineSnapshotTargetService } from '../../machine/services/desired-state/machine-snapshot-target.service';
import { MachineService } from '../../machine/services/machine.service';
import type { GetMachineParams } from '../../machine/types/machine-scheduling.types';
import { MachineJobDispatchService } from '../../machine-job/services/machine-job-dispatch.service';
import { MachineReservationService } from '../../placement/services/machine-reservation.service';
import { MachineSchedulingService } from '../../placement/services/machine-scheduling.service';
import { SandboxRepository } from '../../repositories/sandbox.repository';
import { BuildInfo } from '../../snapshot/entities/build-info.entity';
import {
	type BuildProgress,
	SnapshotBuildProgressService,
} from '../../snapshot/services/snapshot-build-progress.service';
import { DONT_SYNC_AGAIN, SYNC_AGAIN } from './sandbox.action';
import { SandboxBuildAction } from './sandbox-build.action';

const BUILD_REF = 'snapflow-build-ref';
const MACHINE_ID = '1a000000-0000-4000-8000-000000000001';
const BUILD_ERROR = 'Dockerfile step failed';
const SANDBOX_CREATED_AT = new Date('2026-10-03T12:00:00.000Z');
const DOCKERFILE = 'FROM python:3.12-slim';
const ORGANIZATION_ID = '7f9c2a4e-5b1d-4c3a-9e8f-1a2b3c4d5e6f';
const CACHE_REGISTRY = fakeInstance(DockerRegistry, {
	url: 'http://localhost:5001',
	username: '',
	password: '',
	project: 'transient/organization/buildcache',
});

function buildSandbox(overrides: Partial<Sandbox> = {}): Sandbox {
	return Object.assign(new Sandbox({}), {
		id: 'sandbox-1',
		organizationId: ORGANIZATION_ID,
		state: SandboxState.PENDING_BUILD,
		mode: SandboxMode.EPHEMERAL,
		machineId: null,
		pending: true,
		createdAt: SANDBOX_CREATED_AT,
		buildInfo: fakeInstance(BuildInfo, { snapshotRef: BUILD_REF }),
		...overrides,
	});
}

interface Scenario {
	holders?: Machine[];
	candidates?: Machine[];
	progress?: BuildProgress;
	failure?: { errorReason: string | null } | null;
}

function action(scenario: Scenario) {
	const machineService = fakeInstance(MachineService);
	mock.method(machineService, 'findByIds', async () => []);
	const machineScheduling = fakeInstance(MachineSchedulingService);
	const findAvailable = mock.method(
		machineScheduling,
		'findBestMachine',
		async (parameters: GetMachineParams) =>
			(parameters.snapshotRequired
				? scenario.holders
				: scenario.candidates)?.[0] ?? null
	);
	const repository = fakeInstance(SandboxRepository);
	const update = mock.method(
		repository,
		'update',
		async (id: string, params: Parameters<SandboxRepository['update']>[1]) =>
			Object.assign(buildSandbox({ id }), params.updateData)
	);
	const builds = fakeInstance(SnapshotBuildProgressService);
	mock.method(
		builds,
		'progressOn',
		async () => scenario.progress ?? { kind: 'absent' }
	);
	mock.method(builds, 'failureSince', async () => scenario.failure ?? null);
	mock.method(builds, 'machinesBuilding', async () => []);
	const reservations = fakeInstance(MachineReservationService);
	mock.method(reservations, 'reserveSpecific', async () => {
		const machine = scenario.candidates?.[0];
		return machine ? { machine, locality: PlacementLocality.REMOTE } : null;
	});
	const dispatch = fakeInstance(MachineJobDispatchService);
	const buildSnapshot = mock.method(
		dispatch,
		'buildSnapshot',
		async () => undefined
	);
	const registries = fakeInstance(DockerRegistryService);
	mock.method(registries, 'getSourceRegistriesForDockerfile', async () => []);
	const getBuildCacheRegistry = mock.method(
		registries,
		'getBuildCacheRegistry',
		() => CACHE_REGISTRY
	);
	const targets = fakeInstance(MachineSnapshotTargetService);
	const addTarget = mock.method(targets, 'add', async () => undefined);
	const entityManager = fakeInstance(EntityManager, {
		transactional: async (work: (manager: EntityManager) => Promise<void>) =>
			work(fakeInstance(EntityManager)),
	});
	const subject = new SandboxBuildAction(
		machineService,
		repository,
		entityManager,
		reservations,
		dispatch,
		registries,
		targets,
		builds,
		machineScheduling
	);
	return {
		subject,
		findAvailable,
		update,
		buildSnapshot,
		addTarget,
		getBuildCacheRegistry,
	};
}

describe('SandboxBuildAction', () => {
	it('fails a sandbox whose build failed after it was created', async () => {
		const { subject, update } = action({
			failure: { errorReason: BUILD_ERROR },
		});

		const result = await subject.run(buildSandbox());

		assert.equal(result, DONT_SYNC_AGAIN);
		assert.deepEqual(update.mock.calls[0]?.arguments[1].updateData, {
			state: SandboxState.BUILD_FAILED,
			errorReason: BUILD_ERROR,
		});
	});

	it('looks for a machine whose inventory holds the build', async () => {
		const { subject, findAvailable } = action({});

		await subject.run(buildSandbox());

		const [parameters] = findAvailable.mock.calls[0]?.arguments ?? [];
		assert.equal(parameters?.snapshotRef, BUILD_REF);
		assert.equal(parameters?.snapshotRequired, true);
	});

	it('dispatches the build to a new machine when none holds or builds the image', async () => {
		const builder = fakeInstance(Machine, { id: MACHINE_ID });
		const { subject, update, buildSnapshot, addTarget, getBuildCacheRegistry } =
			action({
				candidates: [builder],
			});

		const result = await subject.run(
			buildSandbox({
				buildInfo: fakeInstance(BuildInfo, {
					snapshotRef: BUILD_REF,
					dockerfileContent: DOCKERFILE,
				}),
			})
		);

		assert.equal(result, SYNC_AGAIN);
		assert.equal(buildSnapshot.mock.callCount(), 1);
		assert.deepEqual(getBuildCacheRegistry.mock.calls[0]?.arguments, [
			ORGANIZATION_ID,
		]);
		assert.equal(buildSnapshot.mock.calls[0]?.arguments[3], CACHE_REGISTRY);
		const [, machineId, ref, reason] = addTarget.mock.calls[0]?.arguments ?? [];
		assert.equal(machineId, MACHINE_ID);
		assert.equal(ref, BUILD_REF);
		assert.equal(reason, MachineSnapshotTargetReason.BUILD_CACHE);
		const [, placement] = update.mock.calls[0]?.arguments ?? [];
		assert.equal(placement?.updateData.state, SandboxState.BUILDING_SNAPSHOT);
		assert.equal(placement?.runtimeIntent, undefined);
	});

	it('starts the sandbox once its machine reports the built image', async () => {
		const { subject, update } = action({
			progress: { kind: 'held', builtAt: null },
		});

		const result = await subject.run(
			buildSandbox({
				state: SandboxState.BUILDING_SNAPSHOT,
				machineId: MACHINE_ID,
			})
		);

		assert.equal(result, SYNC_AGAIN);
		assert.equal(
			update.mock.calls[0]?.arguments[1].updateData.state,
			SandboxState.UNKNOWN
		);
	});

	it('places the sandbox again when its machine neither holds nor builds the image', async () => {
		const { subject, update } = action({ progress: { kind: 'absent' } });

		await subject.run(
			buildSandbox({
				state: SandboxState.BUILDING_SNAPSHOT,
				machineId: MACHINE_ID,
			})
		);

		assert.deepEqual(update.mock.calls[0]?.arguments[1].updateData, {
			state: SandboxState.PENDING_BUILD,
			machineId: null,
		});
	});
});
