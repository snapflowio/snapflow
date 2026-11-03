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
	acceptSandboxLeaseRenewal,
	archiveSandbox,
	type CreateSandboxSnapshot,
	createSandboxSnapshot,
	deleteSandbox,
	getSandboxLease,
	type MoveSandbox,
	moveSandbox,
	pauseSandbox,
	recoverSandbox,
	type SandboxLease,
	SandboxState,
	startSandbox,
	stopSandbox,
	WhenMachineUnavailable,
} from '@snapflow/api-client';
import type { StartSandboxOptions } from '../sandbox.types.js';
import { requestSignal } from '../utils/http.js';
import {
	type IdempotentOperationOptions,
	resolveIdempotencyKey,
} from '../utils/idempotency.js';
import {
	assertNonNegativeTimeout,
	DEFAULT_SANDBOX_TIMEOUT_SECONDS,
	remainingTimeoutSeconds,
} from '../utils/timeout.js';
import { SandboxBase } from './sandbox-base.js';
import { waitForSandboxState } from './state-wait.js';

const DEFAULT_WHEN_MACHINE_UNAVAILABLE = WhenMachineUnavailable.Fail;

export abstract class SandboxLifecycle extends SandboxBase {
	public async start({
		whenMachineUnavailable = DEFAULT_WHEN_MACHINE_UNAVAILABLE,
		maxHourlyPriceMicroUsd,
		timeout = DEFAULT_SANDBOX_TIMEOUT_SECONDS,
		signal,
	}: StartSandboxOptions = {}): Promise<void> {
		assertNonNegativeTimeout(timeout);
		const startTime = Date.now();
		const response = await startSandbox({
			client: this.client,
			path: { sandboxIdOrName: this.id },
			body: { whenMachineUnavailable, maxHourlyPriceMicroUsd },
			signal: requestSignal(timeout, signal),
		});
		this.processSandboxDto(response.data);
		await this.waitUntilStarted(
			remainingTimeoutSeconds(timeout, startTime),
			signal
		);
	}

	public async move(params: MoveSandbox = {}): Promise<void> {
		const response = await moveSandbox({
			client: this.client,
			path: { sandboxIdOrName: this.id },
			body: params,
		});
		this.processSandboxDto(response.data);
	}

	public async lease(): Promise<SandboxLease> {
		const response = await getSandboxLease({
			client: this.client,
			path: { sandboxIdOrName: this.id },
		});
		return response.data;
	}

	public async acceptLeaseRenewal(priceCardId: string): Promise<SandboxLease> {
		const response = await acceptSandboxLeaseRenewal({
			client: this.client,
			path: { sandboxIdOrName: this.id },
			body: { priceCardId },
		});
		return response.data;
	}

	public async recover(
		timeout = DEFAULT_SANDBOX_TIMEOUT_SECONDS,
		signal?: AbortSignal
	): Promise<void> {
		assertNonNegativeTimeout(timeout);
		const startTime = Date.now();
		const response = await recoverSandbox({
			client: this.client,
			path: { sandboxIdOrName: this.id },
			signal: requestSignal(timeout, signal),
		});
		this.processSandboxDto(response.data);
		await this.waitUntilStarted(
			remainingTimeoutSeconds(timeout, startTime),
			signal
		);
	}

	public async stop(
		timeout = DEFAULT_SANDBOX_TIMEOUT_SECONDS,
		force = false
	): Promise<void> {
		assertNonNegativeTimeout(timeout);
		const startTime = Date.now();
		const response = await stopSandbox({
			client: this.client,
			path: { sandboxIdOrName: this.id },
			query: { force },
			signal: requestSignal(timeout),
		});
		this.processSandboxDto(response.data);
		await this.waitUntilStopped(remainingTimeoutSeconds(timeout, startTime));
	}

	public async _experimental_createSnapshot(
		name: string,
		timeout = DEFAULT_SANDBOX_TIMEOUT_SECONDS,
		options: IdempotentOperationOptions = {}
	): Promise<void> {
		assertNonNegativeTimeout(timeout);
		const startTime = Date.now();
		const req: CreateSandboxSnapshot = { name };
		const response = await createSandboxSnapshot({
			client: this.client,
			path: { sandboxIdOrName: this.id },
			headers: {
				'Idempotency-Key': resolveIdempotencyKey(options.idempotencyKey),
			},
			body: req,
			signal: requestSignal(timeout),
		});
		this.processSandboxDto(response.data);
		await waitForSandboxState({
			isPending: () => this.state === SandboxState.Snapshotting,
			awaitChange: (waitSeconds, signal) =>
				this.awaitStateChange(waitSeconds, signal),
			failureMessage: () =>
				this.state === SandboxState.Error ||
				this.state === SandboxState.BuildFailed
					? `Sandbox ${this.id} snapshot failed with state: ${this.state}, error reason: ${this.errorReason}`
					: undefined,
			timeoutMessage:
				'Sandbox snapshot did not complete within the timeout period',
			timeoutSeconds: remainingTimeoutSeconds(timeout, startTime),
		});
	}

	public async pause(timeout = DEFAULT_SANDBOX_TIMEOUT_SECONDS): Promise<void> {
		assertNonNegativeTimeout(timeout);
		const startTime = Date.now();
		const response = await pauseSandbox({
			client: this.client,
			path: { sandboxIdOrName: this.id },
			signal: requestSignal(timeout),
		});
		this.processSandboxDto(response.data);
		const remaining = remainingTimeoutSeconds(timeout, startTime);
		await waitForSandboxState({
			isPending: () => this.state === SandboxState.Pausing,
			awaitChange: (waitSeconds, signal) =>
				this.awaitStateChange(waitSeconds, signal),
			failureMessage: () =>
				this.state === SandboxState.Error
					? `Sandbox ${this.id} pause failed with state: ${this.state}, error reason: ${this.errorReason}`
					: undefined,
			timeoutMessage: `Sandbox ${this.id} failed to pause within ${remaining} seconds`,
			timeoutSeconds: remaining,
		});
	}

	public async delete(
		timeout = DEFAULT_SANDBOX_TIMEOUT_SECONDS
	): Promise<void> {
		const response = await deleteSandbox({
			client: this.client,
			path: { sandboxIdOrName: this.id },
			signal: requestSignal(timeout),
		});
		this.processSandboxDto(response.data);
	}

	public async waitUntilStarted(
		timeout = DEFAULT_SANDBOX_TIMEOUT_SECONDS,
		signal?: AbortSignal
	): Promise<void> {
		assertNonNegativeTimeout(timeout);
		await waitForSandboxState({
			isPending: () => this.state !== SandboxState.Started,
			awaitChange: (waitSeconds, requestSignal) =>
				this.awaitStateChange(waitSeconds, requestSignal),
			failureMessage: () =>
				this.state === SandboxState.Error ||
				this.state === SandboxState.BuildFailed ||
				this.state === SandboxState.Destroyed
					? `Sandbox ${this.id} failed to start with status: ${this.state}, error reason: ${this.errorReason}`
					: undefined,
			timeoutMessage:
				'Sandbox failed to become ready within the timeout period',
			timeoutSeconds: timeout,
			signal,
		});
	}

	public async waitUntilStopped(timeout = DEFAULT_SANDBOX_TIMEOUT_SECONDS) {
		assertNonNegativeTimeout(timeout);
		await waitForSandboxState({
			isPending: () =>
				this.state !== SandboxState.Stopped &&
				this.state !== SandboxState.Destroyed,
			awaitChange: (waitSeconds, signal) =>
				this.awaitStateChangeSafe(waitSeconds, signal),
			failureMessage: () =>
				this.state === SandboxState.Error
					? `Sandbox failed to stop with status: ${this.state}, error reason: ${this.errorReason}`
					: undefined,
			timeoutMessage:
				'Sandbox failed to become stopped within the timeout period',
			timeoutSeconds: timeout,
		});
	}

	public async archive(): Promise<void> {
		const response = await archiveSandbox({
			client: this.client,
			path: { sandboxIdOrName: this.id },
		});
		this.processSandboxDto(response.data);
	}
}
