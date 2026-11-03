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
import type { TransactionEventArgs } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { HttpStatus } from '@nestjs/common';
import { SandboxLifecycle } from '@snapflow/machine-proto';
import type { Response } from 'express';
import { Redis } from 'ioredis';
import {
	fakeInstance,
	fakeValue,
} from '../../../../common/testing/instance.fake';
import { ControlWakeService } from '../../../../infra/control-wake/services/control-wake.service';
import { sendControlDocument } from '../../../../infra/control-wake/utils/control-document-long-poll.util';
import { TransactionCommitHooks } from '../../../../infra/database/subscribers/transaction-commit-hooks.subscriber';
import { MACHINE_DESIRED_STATE_WAKE_TOPIC } from '../../constants/machine-desired-state.constants';
import { Machine } from '../../entities/machine.entity';
import {
	type DesiredStateFields,
	desiredStateMachineIds,
} from '../../utils/desired-state/desired-state-change.util';
import { MachineDesiredStateRevisionService } from './machine-desired-state-revision.service';

const FIRST_MACHINE_ID = '1a000000-0000-4000-8000-000000000001';
const SECOND_MACHINE_ID = '2b000000-0000-4000-8000-000000000002';
const LONG_WAIT_SECONDS = '25';
const UNAVAILABLE_MESSAGE = 'unavailable';
const FIRST_DIGEST = 'a'.repeat(64);
const SECOND_DIGEST = 'b'.repeat(64);
const RECEIVING_CLIENTS = 1;

class FakeTransaction {
	readonly handle = {};

	getContext(): FakeTransaction {
		return this;
	}

	getTransactionContext(): object {
		return this.handle;
	}

	commitEvent(): TransactionEventArgs {
		return fakeValue<TransactionEventArgs>({ transaction: this.handle });
	}
}

class RecordingResponse {
	statusCode: number | undefined;
	body: unknown;
	private readonly response: Response = fakeValue<Response>({
		setHeader: () => this.response,
		status: (code: number) => {
			this.statusCode = code;
			return this.response;
		},
		json: (body: unknown) => {
			this.body = body;
			return this.response;
		},
		end: () => this.response,
	});

	asResponse(): Response {
		return this.response;
	}
}

function harness() {
	const commitHooks = new TransactionCommitHooks(
		fakeInstance(EntityManager, {
			getEventManager: () => ({ registerSubscriber: () => undefined }),
		})
	);
	const wakes = new ControlWakeService(
		fakeInstance(Redis, {
			duplicate: () => fakeInstance(Redis, { on: () => undefined }),
			publish: async () => RECEIVING_CLIENTS,
		}),
		commitHooks
	);
	const transaction = new FakeTransaction();
	const manager = fakeInstance(EntityManager);
	mock.method(manager, 'getContext', () => transaction);
	const nativeUpdate = mock.method(manager, 'nativeUpdate', async () => 1);
	return {
		revisions: new MachineDesiredStateRevisionService(wakes),
		wakes,
		commitHooks,
		transaction,
		manager,
		nativeUpdate,
	};
}

function fields(overrides: Partial<DesiredStateFields>): DesiredStateFields {
	return {
		machineId: FIRST_MACHINE_ID,
		specGeneration: 1,
		runtimeLifecycle: SandboxLifecycle.STARTED,
		cpu: 1,
		mem: 1,
		disk: 3,
		gpu: 0,
		...overrides,
	};
}

describe('desiredStateMachineIds', () => {
	it('touches the listing Machine when the spec generation advances', () => {
		assert.deepEqual(
			desiredStateMachineIds(fields({}), fields({ specGeneration: 2 })),
			[FIRST_MACHINE_ID]
		);
	});

	it('touches both Machines when the sandbox moves', () => {
		assert.deepEqual(
			desiredStateMachineIds(
				fields({}),
				fields({ machineId: SECOND_MACHINE_ID })
			),
			[FIRST_MACHINE_ID, SECOND_MACHINE_ID]
		);
	});

	it('touches the Machine whose placement a resize replaced', () => {
		assert.deepEqual(desiredStateMachineIds(fields({}), fields({ cpu: 2 })), [
			FIRST_MACHINE_ID,
		]);
	});

	it('touches the Machine that stops listing a released sandbox', () => {
		assert.deepEqual(
			desiredStateMachineIds(
				fields({}),
				fields({ machineId: null, runtimeLifecycle: null })
			),
			[FIRST_MACHINE_ID]
		);
	});

	it('leaves every document alone for changes a Machine does not see', () => {
		assert.deepEqual(desiredStateMachineIds(fields({}), fields({})), []);
		assert.deepEqual(
			desiredStateMachineIds(
				fields({ runtimeLifecycle: null }),
				fields({ runtimeLifecycle: null, specGeneration: 2 })
			),
			[]
		);
	});

	it('touches the Machine of a sandbox inserted with an intent', () => {
		assert.deepEqual(desiredStateMachineIds(null, fields({})), [
			FIRST_MACHINE_ID,
		]);
	});
});

describe('MachineDesiredStateRevisionService', () => {
	it('advances each touched Machine once, in ID order', async () => {
		const { revisions, manager, nativeUpdate } = harness();

		await revisions.advance(manager, [
			SECOND_MACHINE_ID,
			FIRST_MACHINE_ID,
			SECOND_MACHINE_ID,
		]);

		assert.deepEqual(
			nativeUpdate.mock.calls.map((call) => [
				call.arguments[0],
				call.arguments[1],
			]),
			[
				[Machine, { id: FIRST_MACHINE_ID }],
				[Machine, { id: SECOND_MACHINE_ID }],
			]
		);
	});

	it('does nothing when no Machine is touched', async () => {
		const { revisions, manager, nativeUpdate } = harness();

		await revisions.advance(manager, []);

		assert.equal(nativeUpdate.mock.callCount(), 0);
	});

	it('wakes the long poll of a touched Machine only once the change commits', async () => {
		const { revisions, wakes, commitHooks, transaction, manager } = harness();
		const response = new RecordingResponse();
		let digest = FIRST_DIGEST;

		const polling = sendControlDocument(response.asResponse(), {
			wakes,
			topic: MACHINE_DESIRED_STATE_WAKE_TOPIC,
			subjectId: FIRST_MACHINE_ID,
			ifNoneMatch: `"${FIRST_DIGEST}"`,
			requestedWaitSeconds: LONG_WAIT_SECONDS,
			unavailableMessage: UNAVAILABLE_MESSAGE,
			build: async () => ({ digest }),
		});
		await new Promise((resolve) => setImmediate(resolve));

		await revisions.advance(manager, [FIRST_MACHINE_ID]);
		digest = SECOND_DIGEST;
		await new Promise((resolve) => setImmediate(resolve));
		assert.equal(response.statusCode, undefined);

		commitHooks.afterTransactionCommit(transaction.commitEvent());
		await polling;

		assert.equal(response.statusCode, HttpStatus.OK);
		assert.deepEqual(response.body, { digest: SECOND_DIGEST });
	});
});
