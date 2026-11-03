/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
	SnapflowConnectionError,
	SnapflowError,
	SnapflowNotFoundError,
	SnapflowTimeoutError,
} from '../errors/snapflow-error.js';
import {
	MAX_STATE_CHANGE_WAIT_SECONDS,
	type SandboxStateWait,
	waitForSandboxState,
} from './state-wait.js';

const STARTED = 'started';
const CREATING = 'creating';
const FAILED = 'error';
const SERVER_ERROR_STATUS = 503;
const SHORT_TIMEOUT_SECONDS = 0.05;

type Step = string | Error;

function scriptedWait(
	steps: Step[],
	overrides: Partial<SandboxStateWait> = {}
) {
	let state = CREATING;
	const waits: number[] = [];
	const wait: SandboxStateWait = {
		isPending: () => state !== STARTED,
		awaitChange: async (waitSeconds) => {
			waits.push(waitSeconds);
			const step = steps.shift();
			if (step instanceof Error) throw step;
			if (step !== undefined) state = step;
		},
		failureMessage: () => (state === FAILED ? 'failed' : undefined),
		timeoutMessage: 'timed out',
		timeoutSeconds: 0,
		...overrides,
	};
	return { wait, waits };
}

describe('waitForSandboxState', () => {
	it('resolves on the first pushed change without a poll interval', async () => {
		const { wait, waits } = scriptedWait([STARTED]);

		await waitForSandboxState(wait);

		expect(waits).toEqual([MAX_STATE_CHANGE_WAIT_SECONDS]);
	});

	it('waits again when the server returns the unchanged state', async () => {
		const { wait, waits } = scriptedWait([CREATING, STARTED]);

		await waitForSandboxState(wait);

		expect(waits).toHaveLength(2);
	});

	it('reconnects after a dropped connection or a server error', async () => {
		const { wait, waits } = scriptedWait([
			new SnapflowConnectionError('socket hang up'),
			new SnapflowError('unavailable', SERVER_ERROR_STATUS),
			STARTED,
		]);

		await waitForSandboxState(wait);

		expect(waits).toHaveLength(3);
	});

	it('surfaces errors a reconnect cannot fix', async () => {
		const { wait } = scriptedWait([new SnapflowNotFoundError('gone', 404)]);

		await expect(waitForSandboxState(wait)).rejects.toBeInstanceOf(
			SnapflowNotFoundError
		);
	});

	it('fails on a failure state', async () => {
		const { wait } = scriptedWait([FAILED]);

		await expect(waitForSandboxState(wait)).rejects.toThrow('failed');
	});

	it('times out with the caller message', async () => {
		const { wait } = scriptedWait([], {
			timeoutSeconds: SHORT_TIMEOUT_SECONDS,
			awaitChange: async (waitSeconds, signal) => {
				expect(waitSeconds).toBe(1);
				await new Promise((resolve) =>
					signal?.addEventListener('abort', resolve)
				);
				throw new SnapflowTimeoutError('Operation timed out');
			},
		});

		await expect(waitForSandboxState(wait)).rejects.toThrow('timed out');
	});
});
