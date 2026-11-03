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

import { SystemExposureService } from '@snapflow/api-client';
import type { Client } from '@snapflow/api-client/client';
import {
	EDGE_BACKEND_ACTIVATION_TIMEOUT_MILLISECONDS,
	EdgeAccessSession,
	edgeFetch,
	isSuccessfulResponse,
	retryEdgeRequest,
} from './edge-access-session.js';
import {
	createRequestSnapflowError,
	SnapflowError,
} from './errors/snapflow-error.js';

const SANDBOX_BUILD_LOG_PATH = '/';
const LOG_LINE_SEPARATOR = /\r?\n/;
const HTTP_NOT_FOUND_STATUS = 404;

export type BuildLogHandler = (line: string) => void;

export interface SandboxBuildLogRequest {
	sandboxId: string;
	client: Client;
	sdkVersion?: string;
	signal?: AbortSignal;
}

export async function readSandboxBuildLog(
	request: SandboxBuildLogRequest,
	onLine: BuildLogHandler
): Promise<void> {
	const session = new EdgeAccessSession({
		sandboxId: request.sandboxId,
		service: SystemExposureService.BuildLogs,
		client: request.client,
		sdkVersion: request.sdkVersion,
	});
	const connection = await session.connect();
	const logUrl = new URL(SANDBOX_BUILD_LOG_PATH, connection.baseUrl).toString();
	const response = await retryEdgeRequest({
		deadline: Date.now() + EDGE_BACKEND_ACTIVATION_TIMEOUT_MILLISECONDS,
		timeoutMessage:
			'Sandbox build log did not become available before the access timeout',
		signal: request.signal,
		send: (timeout) =>
			edgeFetch(
				logUrl,
				{
					headers: connection.headers,
					signal: request.signal,
				},
				timeout
			),
	});
	if (!isSuccessfulResponse(response)) {
		await response.body?.cancel();
		throw new SnapflowError(
			`Edge rejected the sandbox build log request with HTTP ${response.status}`,
			response.status
		);
	}
	emitLogLines(await response.text(), onLine);
}

export async function readPresignedBuildLog(
	url: string,
	onLine: BuildLogHandler
): Promise<void> {
	const response = await fetch(url).catch((error: unknown) => {
		throw createRequestSnapflowError(error);
	});
	if (response.status === HTTP_NOT_FOUND_STATUS) {
		await response.body?.cancel();
		return;
	}
	if (!isSuccessfulResponse(response)) {
		await response.body?.cancel();
		throw new SnapflowError(
			`Object storage rejected the snapshot build log request with HTTP ${response.status}`,
			response.status
		);
	}
	emitLogLines(await response.text(), onLine);
}

export function emitLogLines(content: string, onLine: BuildLogHandler): void {
	const trimmed = content.trimEnd();
	if (!trimmed) return;
	for (const line of trimmed.split(LOG_LINE_SEPARATOR)) {
		onLine(line);
	}
}
