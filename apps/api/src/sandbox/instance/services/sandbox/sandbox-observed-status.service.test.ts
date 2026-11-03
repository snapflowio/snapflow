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
import { create, fromJsonString, toJsonString } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	SandboxLifecycle,
	SandboxObservedStatusReportResultSchema,
	SandboxObservedStatusReportSchema,
	SandboxObservedStatusVerdict,
	SandboxRuntimeState,
} from '@snapflow/machine-proto';
import { fakeInstance } from '../../../../common/testing/instance.fake';
import { Machine } from '../../../machine/entities/machine.entity';
import { MachineSession } from '../../../machine/entities/machine-session.entity';
import { MachineSessionService } from '../../../machine/services/machine-session.service';
import { MachineAssessmentService } from '../../../machine/services/qualification/machine-assessment.service';
import { MachineReliabilityService } from '../../../machine/services/qualification/machine-reliability.service';
import { OBSERVED_TRANSITION } from '../../constants/sandbox-state-machine.constants';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxPlacement } from '../../entities/sandbox-placement.entity';
import { SandboxConflictException } from '../../exceptions/sandbox-conflict.exception';
import { SandboxObservedStatusProjector } from './sandbox-observed-status.projector';
import { SandboxObservedStatusService } from './sandbox-observed-status.service';

const MACHINE_ID = 'machine-1';
const OTHER_MACHINE_ID = 'machine-2';
const ASSIGNMENT_GENERATION = 3;
const SPEC_GENERATION = 5;
const NOW = new Date('2026-10-04T12:00:00.000Z');

function sandbox(): Sandbox {
	return Object.assign(new Sandbox({}), {
		machineId: MACHINE_ID,
		specGeneration: SPEC_GENERATION,
		runtimeLifecycle: SandboxLifecycle.STARTED,
	});
}

function placement(machineId = MACHINE_ID): SandboxPlacement {
	return Object.assign(new SandboxPlacement(), {
		id: 'placement-1',
		machineId,
		assignmentGeneration: ASSIGNMENT_GENERATION,
		releasedAt: null,
	});
}

function report(
	sandboxId: string,
	overrides: {
		assignmentGeneration?: number;
		observedSpecGeneration?: number;
		withResult?: boolean;
	} = {}
): string {
	return toJsonString(
		SandboxObservedStatusReportSchema,
		create(SandboxObservedStatusReportSchema, {
			statuses: [
				{
					sandboxId,
					assignmentGeneration:
						overrides.assignmentGeneration ?? ASSIGNMENT_GENERATION,
					observedSpecGeneration:
						overrides.observedSpecGeneration ?? SPEC_GENERATION,
					state: SandboxRuntimeState.STARTED,
					observedAt: timestampFromDate(NOW),
					result: overrides.withResult
						? {
								phase: 'guest_readiness',
								runtimeIdentity: 'runtime',
								releaseIdentity: 'release',
							}
						: undefined,
				},
			],
		})
	);
}

function serviceFor(
	current: Sandbox | null,
	active: SandboxPlacement | null,
	projection: () => Promise<string> = async () => OBSERVED_TRANSITION.STARTED
) {
	const transaction = fakeInstance(EntityManager);
	mock.method(transaction, 'findOne', async (entity: unknown) =>
		entity === Sandbox ? current : active
	);
	const store = mock.method(transaction, 'execute', async () => [{ now: NOW }]);
	const entityManager = fakeInstance(EntityManager);
	mock.method(
		entityManager,
		'transactional',
		async (work: (manager: EntityManager) => Promise<unknown>) =>
			work(transaction)
	);
	const sessions = fakeInstance(MachineSessionService);
	mock.method(sessions, 'assertCurrent', async () => new Machine());
	const projector = fakeInstance(SandboxObservedStatusProjector);
	const project = mock.method(projector, 'project', projection);
	const reliability = fakeInstance(MachineReliabilityService);
	const recordConvergence = mock.method(
		reliability,
		'recordSandboxConvergence',
		async () => true
	);
	const capacity = fakeInstance(MachineAssessmentService);
	const assess = mock.method(capacity, 'assess', async () => undefined);
	return {
		service: new SandboxObservedStatusService(
			entityManager,
			sessions,
			projector,
			reliability,
			capacity
		),
		store,
		project,
		recordConvergence,
		assess,
	};
}

function session(): MachineSession {
	return Object.assign(new MachineSession(), { id: 'session-1' });
}

function verdicts(result: string) {
	return fromJsonString(SandboxObservedStatusReportResultSchema, result)
		.acknowledgements;
}

describe('SandboxObservedStatusService.report', () => {
	it('stores and projects a status from the Machine holding the assignment', async () => {
		const current = sandbox();
		const { service, project, store } = serviceFor(current, placement());

		const { result } = await service.report(
			MACHINE_ID,
			session(),
			report(current.id)
		);

		assert.equal(
			verdicts(result)[0]?.verdict,
			SandboxObservedStatusVerdict.ACCEPTED
		);
		const upsert = store.mock.calls.find(({ arguments: [query] }) =>
			String(query).includes('sandbox_observed_status')
		);
		assert.deepEqual(upsert?.arguments[1]?.slice(0, 4), [
			current.id,
			MACHINE_ID,
			ASSIGNMENT_GENERATION,
			SPEC_GENERATION,
		]);
		assert.equal(project.mock.callCount(), 1);
	});

	it('fences a Machine that does not hold the active placement', async () => {
		const current = sandbox();
		const { service, project } = serviceFor(
			current,
			placement(OTHER_MACHINE_ID)
		);

		const { result } = await service.report(
			MACHINE_ID,
			session(),
			report(current.id)
		);

		assert.equal(
			verdicts(result)[0]?.verdict,
			SandboxObservedStatusVerdict.STALE
		);
		assert.equal(project.mock.callCount(), 0);
	});

	it('fences a status for a superseded assignment generation', async () => {
		const current = sandbox();
		const { service, project } = serviceFor(current, placement());

		const { result } = await service.report(
			MACHINE_ID,
			session(),
			report(current.id, { assignmentGeneration: ASSIGNMENT_GENERATION - 1 })
		);

		assert.equal(
			verdicts(result)[0]?.verdict,
			SandboxObservedStatusVerdict.STALE
		);
		assert.equal(project.mock.callCount(), 0);
	});

	it('rejects a spec generation the API never issued', async () => {
		const current = sandbox();
		const { service, project } = serviceFor(current, placement());

		const { result } = await service.report(
			MACHINE_ID,
			session(),
			report(current.id, { observedSpecGeneration: SPEC_GENERATION + 1 })
		);

		assert.equal(
			verdicts(result)[0]?.verdict,
			SandboxObservedStatusVerdict.INVALID
		);
		assert.equal(project.mock.callCount(), 0);
	});

	it('tells the Machine about a sandbox the API does not know', async () => {
		const { service } = serviceFor(null, null);

		const { result } = await service.report(
			MACHINE_ID,
			session(),
			report('missing-sandbox')
		);

		assert.equal(
			verdicts(result)[0]?.verdict,
			SandboxObservedStatusVerdict.UNKNOWN
		);
	});

	it('attributes a finished generation and reassesses the Machine', async () => {
		const current = sandbox();
		const { service, recordConvergence, assess } = serviceFor(
			current,
			placement()
		);

		await service.report(
			MACHINE_ID,
			session(),
			report(current.id, { withResult: true })
		);

		assert.equal(recordConvergence.mock.callCount(), 1);
		assert.equal(
			recordConvergence.mock.calls[0]?.arguments[1]?.specGeneration,
			SPEC_GENERATION
		);
		assert.equal(assess.mock.callCount(), 1);
	});

	it('acknowledges a status whose projection lost a concurrent race', async () => {
		const current = sandbox();
		const { service } = serviceFor(current, placement(), async () => {
			throw new SandboxConflictException();
		});

		const { result } = await service.report(
			MACHINE_ID,
			session(),
			report(current.id)
		);

		assert.equal(
			verdicts(result)[0]?.verdict,
			SandboxObservedStatusVerdict.ACCEPTED
		);
	});
});
