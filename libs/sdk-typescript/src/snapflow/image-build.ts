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
	awaitSandboxStateChange,
	type Sandbox as SandboxDto,
	SandboxState,
} from '@snapflow/api-client';
import type { Client } from '@snapflow/api-client/client';
import { readSandboxBuildLog } from '../build-logs.js';
import { waitForSandboxState } from '../sandbox/state-wait.js';
import { remainingTimeoutSeconds } from '../utils/timeout.js';

const IMAGE_BUILD_STATES: readonly SandboxState[] = [
	SandboxState.PendingBuild,
	SandboxState.BuildingSnapshot,
];

export function isImageBuildState(state: SandboxState | undefined): boolean {
	return state !== undefined && IMAGE_BUILD_STATES.includes(state);
}

export async function waitForImageBuild(
	client: Client,
	sandbox: SandboxDto,
	timeout: number,
	startTime: number,
	signal?: AbortSignal
): Promise<SandboxDto> {
	let current = sandbox;
	await waitForSandboxState({
		isPending: () => isImageBuildState(current.state),
		awaitChange: async (waitSeconds, requestSignal) => {
			current = (
				await awaitSandboxStateChange({
					client,
					path: { sandboxIdOrName: current.id },
					query: {
						observedState: current.state ?? SandboxState.Unknown,
						waitSeconds,
					},
					signal: requestSignal,
				})
			).data;
		},
		failureMessage: () => undefined,
		timeoutMessage: `Sandbox image build did not finish within ${timeout} seconds. Please check the sandbox state again later.`,
		timeoutSeconds: remainingTimeoutSeconds(timeout, startTime),
		signal,
	});
	return current;
}

export async function forwardSandboxBuildLog(
	sandbox: SandboxDto,
	client: Client,
	sdkVersion: string,
	onLogs: (chunk: string) => void,
	signal?: AbortSignal
): Promise<void> {
	await readSandboxBuildLog(
		{
			sandboxId: sandbox.id,
			client,
			sdkVersion,
			signal,
		},
		onLogs
	).catch((error: unknown) =>
		onLogs(
			`Build log unavailable: ${error instanceof Error ? error.message : String(error)}`
		)
	);
}
