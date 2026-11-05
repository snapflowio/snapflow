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
import { Redis } from 'ioredis';
import { fakeInstance } from '../../../common/testing/instance.fake';
import { ControlWakeService } from '../../../infra/control-wake/services/control-wake.service';
import { TransactionCommitHooks } from '../../../infra/database/subscribers/transaction-commit-hooks.subscriber';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxDesiredState } from '../../enums/sandbox-desired-state.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { SandboxDesiredStateUpdatedEvent } from '../../events/sandbox-desired-state-updated.event';
import { SandboxStateUpdatedEvent } from '../../events/sandbox-state-updated.event';
import { SandboxStateWakeListener } from '../../managers/sandbox-state-wake.listener';
import { SandboxService } from './sandbox.service';
import { SandboxStateWaitService } from './sandbox-state-wait.service';

const SANDBOX_ID = '3c000000-0000-4000-8000-000000000003';
const ORGANIZATION_ID = '4d000000-0000-4000-8000-000000000004';
const LONG_WAIT_SECONDS = 25;
const SHORT_WAIT_SECONDS = 1;
const PROMPT_WAKE_MILLISECONDS = 1_000;
const RECEIVING_CLIENTS = 1;

function sandbox(
	state: SandboxState,
	desiredState = SandboxDesiredState.STARTED
): Sandbox {
	return fakeInstance(Sandbox, {
		id: SANDBOX_ID,
		organizationId: ORGANIZATION_ID,
		state,
		desiredState,
		volumes: [],
	});
}

type ScriptedSandbox = Pick<Sandbox, 'state' | 'desiredState'>;

function scripted(state: SandboxState): ScriptedSandbox {
	return { state, desiredState: SandboxDesiredState.STARTED };
}

function harness(states: ScriptedSandbox[]) {
	const wakes = new ControlWakeService(
		fakeInstance(Redis, {
			duplicate: () => fakeInstance(Redis, { on: () => undefined }),
			publish: async () => RECEIVING_CLIENTS,
		}),
		new TransactionCommitHooks(
			fakeInstance(EntityManager, {
				getEventManager: () => ({ registerSubscriber: () => undefined }),
			})
		)
	);
	const remaining = [...states];
	const sandboxes = fakeInstance(SandboxService);
	const lookups = mock.method(sandboxes, 'findOneByIdOrName', async () => {
		const next = remaining.length > 1 ? remaining.shift() : remaining[0];
		if (!next) throw new Error('No sandbox state is scripted');
		return sandbox(next.state, next.desiredState);
	});
	const entityManager = fakeInstance(EntityManager, {
		fork: () => fakeInstance(EntityManager),
	});
	return {
		wakes,
		lookups,
		listener: new SandboxStateWakeListener(wakes),
		waits: new SandboxStateWaitService(entityManager, sandboxes, wakes),
		advance: (next: ScriptedSandbox) => {
			remaining.splice(0, remaining.length, next);
		},
	};
}

describe('SandboxStateWaitService', () => {
	it('returns at once when the state already differs', async () => {
		const { waits, lookups } = harness([scripted(SandboxState.STARTED)]);

		const result = await waits.awaitChange(
			SANDBOX_ID,
			ORGANIZATION_ID,
			SandboxState.CREATING,
			LONG_WAIT_SECONDS
		);

		assert.equal(result.state, SandboxState.STARTED);
		assert.equal(lookups.mock.callCount(), 1);
	});

	it('resolves on the state wake instead of the deadline', async () => {
		const test = harness([scripted(SandboxState.CREATING)]);
		const startedAt = Date.now();

		const waiting = test.waits.awaitChange(
			SANDBOX_ID,
			ORGANIZATION_ID,
			SandboxState.CREATING,
			LONG_WAIT_SECONDS
		);
		await new Promise((resolve) => setImmediate(resolve));
		test.advance(scripted(SandboxState.STARTED));
		test.listener.wakeOnStateChange(
			new SandboxStateUpdatedEvent(
				sandbox(SandboxState.STARTED),
				SandboxState.CREATING,
				SandboxState.STARTED
			)
		);
		const result = await waiting;

		assert.equal(result.state, SandboxState.STARTED);
		assert.ok(Date.now() - startedAt < PROMPT_WAKE_MILLISECONDS);
	});

	it('sees a change committed before the wake was captured', async () => {
		const { waits, lookups } = harness([
			scripted(SandboxState.CREATING),
			scripted(SandboxState.STARTED),
		]);

		const result = await waits.awaitChange(
			SANDBOX_ID,
			ORGANIZATION_ID,
			SandboxState.CREATING,
			LONG_WAIT_SECONDS
		);

		assert.equal(result.state, SandboxState.STARTED);
		assert.equal(lookups.mock.callCount(), 2);
	});

	it('compares and wakes on the state the API reports', async () => {
		const test = harness([scripted(SandboxState.STARTED)]);

		const waiting = test.waits.awaitChange(
			SANDBOX_ID,
			ORGANIZATION_ID,
			SandboxState.STARTED,
			LONG_WAIT_SECONDS
		);
		await new Promise((resolve) => setImmediate(resolve));
		test.advance({
			state: SandboxState.STARTED,
			desiredState: SandboxDesiredState.STOPPED,
		});
		test.listener.wakeOnDesiredStateChange(
			new SandboxDesiredStateUpdatedEvent(
				sandbox(SandboxState.STARTED, SandboxDesiredState.STOPPED),
				SandboxDesiredState.STARTED,
				SandboxDesiredState.STOPPED
			)
		);
		const result = await waiting;

		assert.equal(result.state, SandboxState.STARTED);
		assert.equal(result.desiredState, SandboxDesiredState.STOPPED);
	});

	it('returns the unchanged sandbox once the wait elapses', async () => {
		const { waits } = harness([scripted(SandboxState.CREATING)]);

		const result = await waits.awaitChange(
			SANDBOX_ID,
			ORGANIZATION_ID,
			SandboxState.CREATING,
			SHORT_WAIT_SECONDS
		);

		assert.equal(result.state, SandboxState.CREATING);
	});

	it('does not hold a request while the API shuts down', async () => {
		const { waits, wakes, lookups } = harness([
			scripted(SandboxState.CREATING),
		]);
		wakes.beforeApplicationShutdown();

		const result = await waits.awaitChange(
			SANDBOX_ID,
			ORGANIZATION_ID,
			SandboxState.CREATING,
			LONG_WAIT_SECONDS
		);

		assert.equal(result.state, SandboxState.CREATING);
		assert.equal(lookups.mock.callCount(), 1);
	});
});
