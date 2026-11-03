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
	SnapflowRateLimitError,
	SnapflowTimeoutError,
} from '../errors/snapflow-error.js';
import { abortableDelay } from '../utils/async.js';
import { requestSignal } from '../utils/http.js';
import { Deadline } from '../utils/timeout.js';

export const MAX_STATE_CHANGE_WAIT_SECONDS = 25;
const RECONNECT_INITIAL_DELAY_MILLISECONDS = 100;
const RECONNECT_MAX_DELAY_MILLISECONDS = 1000;
const RECONNECT_BACKOFF_FACTOR = 2;
const FIRST_SERVER_ERROR_STATUS = 500;

export interface SandboxStateWait {
	isPending: () => boolean;
	awaitChange: (waitSeconds: number, signal?: AbortSignal) => Promise<void>;
	failureMessage: () => string | undefined;
	timeoutMessage: string;
	timeoutSeconds: number;
	signal?: AbortSignal;
}

export async function waitForSandboxState(
	wait: SandboxStateWait
): Promise<void> {
	const deadline = Deadline.after(wait.timeoutSeconds);
	let reconnectDelay = RECONNECT_INITIAL_DELAY_MILLISECONDS;

	while (isStillPending(wait, deadline)) {
		try {
			await awaitStateChange(wait, deadline);
			reconnectDelay = RECONNECT_INITIAL_DELAY_MILLISECONDS;
		} catch (error) {
			throwUnlessReconnectable(error, wait, deadline);
			await abortableDelay(reconnectDelay, wait.signal);
			reconnectDelay = Math.min(
				reconnectDelay * RECONNECT_BACKOFF_FACTOR,
				RECONNECT_MAX_DELAY_MILLISECONDS
			);
		}
	}
}

function isStillPending(wait: SandboxStateWait, deadline: Deadline): boolean {
	const failure = wait.failureMessage();
	if (failure !== undefined) {
		throw new SnapflowError(failure);
	}
	if (!wait.isPending()) {
		return false;
	}
	wait.signal?.throwIfAborted();
	if (deadline.isExpired()) {
		throw new SnapflowTimeoutError(wait.timeoutMessage);
	}
	return true;
}

function awaitStateChange(
	wait: SandboxStateWait,
	deadline: Deadline
): Promise<void> {
	const remainingSeconds = deadline.remainingSeconds();
	return wait.awaitChange(
		Math.ceil(
			Math.min(
				remainingSeconds ?? MAX_STATE_CHANGE_WAIT_SECONDS,
				MAX_STATE_CHANGE_WAIT_SECONDS
			)
		),
		requestSignal(remainingSeconds, wait.signal)
	);
}

function throwUnlessReconnectable(
	error: unknown,
	wait: SandboxStateWait,
	deadline: Deadline
): void {
	wait.signal?.throwIfAborted();
	if (deadline.isExpired()) {
		throw new SnapflowTimeoutError(wait.timeoutMessage);
	}
	if (!isReconnectable(error)) {
		throw error;
	}
}

function isReconnectable(error: unknown): boolean {
	return (
		error instanceof SnapflowConnectionError ||
		error instanceof SnapflowRateLimitError ||
		(error instanceof SnapflowError &&
			error.statusCode !== undefined &&
			error.statusCode >= FIRST_SERVER_ERROR_STATUS)
	);
}
