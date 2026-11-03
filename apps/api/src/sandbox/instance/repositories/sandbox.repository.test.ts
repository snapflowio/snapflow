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
import { UnitOfWork } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SandboxLifecycle } from '@snapflow/machine-proto';
import { fakeInstance } from '../../../common/testing/instance.fake';
import { TransactionCommitHooks } from '../../../infra/database/subscribers/transaction-commit-hooks.subscriber';
import { Machine } from '../../machine/entities/machine.entity';
import { MachineDesiredStateRevisionService } from '../../machine/services/desired-state/machine-desired-state-revision.service';
import { SandboxPlacementService } from '../../placement/services/sandbox-placement.service';
import { SandboxEvents } from '../constants/sandbox-events.constants';
import { Sandbox } from '../entities/sandbox.entity';
import { PlacementLocality } from '../enums/placement-locality.enum';
import { SandboxDesiredState } from '../enums/sandbox-desired-state.enum';
import { SandboxState } from '../enums/sandbox-state.enum';
import type { SandboxStateUpdatedEvent } from '../events/sandbox-state-updated.event';
import { SandboxConflictException } from '../exceptions/sandbox-conflict.exception';
import { SandboxRepository } from './sandbox.repository';

const PERSISTED_MACHINE_ID = 'machine-persisted';
const NEW_MACHINE_ID = 'machine-new';

function persistedSandbox(): Sandbox {
	return Object.assign(new Sandbox({}), {
		organizationId: 'organization-1',
		machineId: PERSISTED_MACHINE_ID,
		state: SandboxState.STOPPED,
		desiredState: SandboxDesiredState.STARTED,
		pending: true,
	});
}

function repositoryFor(sandbox: Sandbox, affectedRows: number) {
	const unitOfWork = fakeInstance(UnitOfWork);
	mock.method(unitOfWork, 'getOriginalEntityData', () => ({
		state: SandboxState.STOPPED,
		desiredState: SandboxDesiredState.STARTED,
		pending: true,
		organizationId: sandbox.organizationId,
		machineId: PERSISTED_MACHINE_ID,
	}));
	mock.method(unitOfWork, 'merge', () => undefined);

	const transaction = fakeInstance(EntityManager);
	const updates: Partial<Sandbox>[] = [];
	const nativeUpdate = mock.method(
		transaction,
		'nativeUpdate',
		async (...update: [unknown, unknown, Partial<Sandbox>]) => {
			updates.push(update[2]);
			return affectedRows;
		}
	);
	mock.method(transaction, 'upsert', async () => ({}));

	const entityManager = fakeInstance(EntityManager);
	mock.method(entityManager, 'getUnitOfWork', () => unitOfWork);
	mock.method(
		entityManager,
		'transactional',
		async (work: (manager: EntityManager) => Promise<void>) => work(transaction)
	);

	const placements = fakeInstance(SandboxPlacementService);
	mock.method(placements, 'synchronizeAssignment', async () => null);
	const desiredStateRevisions = fakeInstance(
		MachineDesiredStateRevisionService
	);
	const advance = mock.method(
		desiredStateRevisions,
		'advance',
		async () => undefined
	);
	const events = new EventEmitter2();
	const commitHooks = fakeInstance(TransactionCommitHooks);
	const deferUntilCommit: TransactionCommitHooks['runAfterCommit'] = () =>
		undefined;
	const afterCommit = mock.method(
		commitHooks,
		'runAfterCommit',
		deferUntilCommit
	);

	const repository = fakeInstance(SandboxRepository);
	Object.assign(repository, {
		entityManager,
		eventEmitter: events,
		sandboxPlacementService: placements,
		desiredStateRevisions,
		commitHooks,
	});
	return {
		repository,
		nativeUpdate,
		updates,
		advance,
		events,
		afterCommit,
		entityManager,
	};
}

describe('SandboxRepository.update', () => {
	it('compares against persisted values, not unsaved in-memory mutations', async () => {
		const sandbox = persistedSandbox();
		const { repository, nativeUpdate } = repositoryFor(sandbox, 1);
		sandbox.machineId = null;

		await repository.update(sandbox.id, {
			entity: sandbox,
			updateData: { state: SandboxState.RESTORING, machineId: NEW_MACHINE_ID },
		});

		const guard = nativeUpdate.mock.calls[0].arguments[1];
		assert.deepEqual(guard, {
			id: sandbox.id,
			state: SandboxState.STOPPED,
			desiredState: SandboxDesiredState.STARTED,
			pending: true,
			organizationId: sandbox.organizationId,
			machineId: PERSISTED_MACHINE_ID,
			specGeneration: 0,
		});
		assert.equal(sandbox.machineId, NEW_MACHINE_ID);
		assert.equal(sandbox.state, SandboxState.RESTORING);
	});

	it('leaves the entity untouched when the row changed concurrently', async () => {
		const sandbox = persistedSandbox();
		const { repository } = repositoryFor(sandbox, 0);

		await assert.rejects(
			repository.update(sandbox.id, {
				entity: sandbox,
				updateData: { state: SandboxState.STARTING },
			}),
			SandboxConflictException
		);
		assert.equal(sandbox.state, SandboxState.STOPPED);
	});

	it('issues a runtime intent as the next spec generation and wakes its Machine', async () => {
		const sandbox = persistedSandbox();
		const { repository, updates, advance } = repositoryFor(sandbox, 1);

		await repository.update(sandbox.id, {
			entity: sandbox,
			updateData: { state: SandboxState.STARTING },
			runtimeIntent: { lifecycle: SandboxLifecycle.STARTED },
		});

		const [changes] = updates;
		assert.ok(changes);
		assert.equal(changes.specGeneration, 1);
		assert.equal(changes.runtimeLifecycle, SandboxLifecycle.STARTED);
		assert.deepEqual(advance.mock.calls[0].arguments[1], [
			PERSISTED_MACHINE_ID,
		]);
	});

	it('emits plain-data events only once the transaction commits', async () => {
		const sandbox = persistedSandbox();
		const { repository, events, afterCommit, entityManager } = repositoryFor(
			sandbox,
			1
		);
		const received: SandboxStateUpdatedEvent[] = [];
		events.on(SandboxEvents.STATE_UPDATED, (event: SandboxStateUpdatedEvent) =>
			received.push(event)
		);

		await repository.update(sandbox.id, {
			entity: sandbox,
			updateData: { state: SandboxState.STARTING },
		});

		assert.equal(received.length, 0);
		const [deferred] = afterCommit.mock.calls;
		assert.equal(deferred?.arguments[0], entityManager);
		deferred?.arguments[1]();
		assert.equal(received.length, 1);
		assert.equal(received[0]?.sandbox instanceof Sandbox, false);
		assert.equal(received[0]?.sandbox.id, sandbox.id);
		assert.equal(received[0]?.newState, SandboxState.STARTING);
	});
});

describe('SandboxRepository.insertWithMachineReservation', () => {
	it('lists a create with its runtime intent on the reserved Machine in one transaction', async () => {
		const sandbox = Object.assign(new Sandbox({}), {
			organizationId: 'organization-1',
			state: SandboxState.CREATING,
			desiredState: SandboxDesiredState.STARTED,
		});
		const { repository, advance, entityManager } = repositoryFor(sandbox, 1);
		const transaction = fakeInstance(EntityManager);
		mock.method(transaction, 'persist', () => transaction);
		const flush = mock.method(transaction, 'flush', async () => undefined);
		mock.method(transaction, 'upsert', async () => ({}));
		mock.method(
			entityManager,
			'transactional',
			async (work: (manager: EntityManager) => Promise<void>) =>
				work(transaction)
		);
		const intentMachines: string[] = [];

		await repository.insertWithMachineReservation(sandbox, {
			reserveMachine: async () => ({
				machine: fakeInstance(Machine, { id: NEW_MACHINE_ID }),
				locality: PlacementLocality.REMOTE,
			}),
			runtimeIntent: async (machineId) => {
				intentMachines.push(machineId);
				return { lifecycle: SandboxLifecycle.STARTED };
			},
		});

		assert.deepEqual(intentMachines, [NEW_MACHINE_ID]);
		assert.equal(sandbox.runtimeLifecycle, SandboxLifecycle.STARTED);
		assert.equal(sandbox.specGeneration, 1);
		assert.equal(flush.mock.callCount(), 2);
		assert.deepEqual(advance.mock.calls[0].arguments[1], [NEW_MACHINE_ID]);
	});
});
