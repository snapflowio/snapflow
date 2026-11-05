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
import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { EntityManager } from '@mikro-orm/postgresql';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
	SandboxImageSchema,
	SandboxLifecycle,
	SandboxObservedStatusSchema,
	SandboxRuntimeState,
} from '@snapflow/machine-proto';
import { fakeInstance } from '../../../common/testing/instance.fake';
import { runtimeIntentUpdate } from '../../../machine/utils/proto/sandbox-runtime-intent.util';
import { buildSandboxSpec } from '../../../machine/utils/proto/sandbox-runtime-spec.util';
import { OrganizationUsageService } from '../../../organization/services/organization-usage.service';
import { VolumeAttachmentService } from '../../../volume/services/volume-attachment.service';
import { SandboxEvents } from '../../constants/sandbox-events.constants';
import { OBSERVED_TRANSITION } from '../../constants/sandbox-state-machine.constants';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxDesiredState } from '../../enums/sandbox-desired-state.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { SandboxRepository } from '../../repositories/sandbox.repository';
import { SandboxObservedStatusProjector } from './sandbox-observed-status.projector';

type UpdateWhereParams = Parameters<SandboxRepository['updateWhere']>[1];

const MACHINE_ID = 'machine-1';
const SPEC_GENERATION = 4;
const OBSERVED_AT = new Date('2026-10-04T12:00:00.000Z');

function listedSandbox(
	overrides: Partial<Sandbox>,
	lifecycle = SandboxLifecycle.STARTED,
	resources = { cpu: 2, mem: 4, disk: 10 }
): Sandbox {
	const sandbox = Object.assign(new Sandbox({}), {
		organizationId: 'organization-1',
		machineId: MACHINE_ID,
		state: SandboxState.CREATING,
		desiredState: SandboxDesiredState.STARTED,
		cpu: 1,
		mem: 1,
		disk: 3,
		createdAt: OBSERVED_AT,
		...overrides,
	});
	return Object.assign(
		sandbox,
		runtimeIntentUpdate(
			{ specGeneration: SPEC_GENERATION - 1 },
			{
				lifecycle,
				spec: buildSandboxSpec({
					sandbox: { ...sandbox, ...resources },
					source: {
						case: 'image',
						value: create(SandboxImageSchema, { ref: 'image:1' }),
					},
					fencedVolumes: new Map(),
					labels: {},
				}),
			}
		)
	);
}

function status(
	sandbox: Sandbox,
	state: SandboxRuntimeState,
	observedSpecGeneration = SPEC_GENERATION
) {
	return create(SandboxObservedStatusSchema, {
		sandboxId: sandbox.id,
		assignmentGeneration: 1,
		observedSpecGeneration,
		state,
		daemonVersion: '1.0.0',
		observedAt: timestampFromDate(OBSERVED_AT),
	});
}

function projectorFor(sandbox: Sandbox) {
	const entityManager = fakeInstance(EntityManager);
	mock.method(entityManager, 'findOne', async () => sandbox);
	const repository = fakeInstance(SandboxRepository);
	const updateWhere = mock.method(
		repository,
		'updateWhere',
		async (id: string, params: UpdateWhereParams) =>
			Object.assign(new Sandbox({}), sandbox, params.updateData, {
				id,
				updatedAt: OBSERVED_AT,
			})
	);
	const usage = fakeInstance(OrganizationUsageService);
	const applyResize = mock.method(
		usage,
		'applyResizeUsageChange',
		async () => undefined
	);
	const attachments = fakeInstance(VolumeAttachmentService);
	const releaseAttachments = mock.method(
		attachments,
		'releaseAttachments',
		async () => undefined
	);
	const events = new EventEmitter2();
	const emitted: string[] = [];
	events.onAny((event: string | string[]) => {
		emitted.push(String(event));
	});
	return {
		projector: new SandboxObservedStatusProjector(
			entityManager,
			repository,
			usage,
			attachments,
			events
		),
		updateWhere,
		applyResize,
		releaseAttachments,
		emitted,
	};
}

describe('SandboxObservedStatusProjector', () => {
	it('settles a create through a compare-and-set on the decided version', async () => {
		const sandbox = listedSandbox({});
		const { projector, updateWhere } = projectorFor(sandbox);

		const transition = await projector.project(
			status(sandbox, SandboxRuntimeState.STARTED)
		);

		assert.equal(transition, OBSERVED_TRANSITION.STARTED);
		const [, params] = updateWhere.mock.calls[0].arguments;
		assert.deepEqual(params.whereCondition, {
			state: SandboxState.CREATING,
			specGeneration: SPEC_GENERATION,
			machineId: MACHINE_ID,
		});
		assert.equal(params.updateData.state, SandboxState.STARTED);
		assert.equal(params.updateData.daemonVersion, '1.0.0');
	});

	it('applies nothing for a generation the Machine has not finished', async () => {
		const sandbox = listedSandbox({});
		const { projector, updateWhere } = projectorFor(sandbox);

		const transition = await projector.project(
			status(sandbox, SandboxRuntimeState.STARTED, SPEC_GENERATION - 1)
		);

		assert.equal(transition, OBSERVED_TRANSITION.NONE);
		assert.equal(updateWhere.mock.callCount(), 0);
	});

	it('releases the assignment of a failed create', async () => {
		const sandbox = listedSandbox({});
		const { projector, updateWhere } = projectorFor(sandbox);

		await projector.project(status(sandbox, SandboxRuntimeState.ERROR));

		const [, params] = updateWhere.mock.calls[0].arguments;
		assert.equal(params.updateData.state, SandboxState.ERROR);
		assert.equal(params.updateData.machineId, null);
	});

	it('stops converging a runtime that exited on its own', async () => {
		const sandbox = listedSandbox({
			state: SandboxState.STARTED,
			pending: false,
		});
		const { projector, updateWhere } = projectorFor(sandbox);

		await projector.project(status(sandbox, SandboxRuntimeState.STOPPED));

		const [, params] = updateWhere.mock.calls[0].arguments;
		assert.equal(params.updateData.desiredState, SandboxDesiredState.STOPPED);
		assert.deepEqual(params.runtimeIntent, {
			lifecycle: SandboxLifecycle.STOPPED,
		});
	});

	it('applies the resized resources and their usage once converged', async () => {
		const sandbox = listedSandbox(
			{
				state: SandboxState.RESIZING,
				desiredState: SandboxDesiredState.STOPPED,
			},
			SandboxLifecycle.STOPPED,
			{ cpu: 2, mem: 4, disk: 10 }
		);
		const { projector, updateWhere, applyResize } = projectorFor(sandbox);

		await projector.project(status(sandbox, SandboxRuntimeState.STOPPED));

		assert.equal(applyResize.mock.calls[0].arguments[4], 7);
		const [, params] = updateWhere.mock.calls[0].arguments;
		assert.equal(params.updateData.cpu, 2);
		assert.equal(params.updateData.mem, 4);
		assert.equal(params.updateData.disk, 10);
		assert.equal(params.updateData.state, SandboxState.STOPPED);
	});

	it('releases volume attachments once the runtime is destroyed', async () => {
		const sandbox = listedSandbox(
			{
				state: SandboxState.DESTROYING,
				desiredState: SandboxDesiredState.DESTROYED,
			},
			SandboxLifecycle.DESTROYED
		);
		const { projector, releaseAttachments } = projectorFor(sandbox);

		await projector.project(status(sandbox, SandboxRuntimeState.DESTROYED));

		assert.deepEqual(releaseAttachments.mock.calls[0].arguments, [sandbox.id]);
	});

	it('continues a requested start after an in-place recovery', async () => {
		const sandbox = listedSandbox(
			{ state: SandboxState.ERROR, errorReason: 'no space left on device' },
			SandboxLifecycle.STOPPED
		);
		Object.assign(
			sandbox,
			runtimeIntentUpdate(
				{ specGeneration: SPEC_GENERATION - 1 },
				{
					lifecycle: SandboxLifecycle.STOPPED,
					directives: { recovery: { errorReason: 'no space left on device' } },
				}
			)
		);
		const { projector, emitted } = projectorFor(sandbox);

		const transition = await projector.project(
			status(sandbox, SandboxRuntimeState.STOPPED)
		);

		assert.equal(transition, OBSERVED_TRANSITION.RECOVERED);
		assert.deepEqual(emitted, [SandboxEvents.STARTED]);
	});
});
