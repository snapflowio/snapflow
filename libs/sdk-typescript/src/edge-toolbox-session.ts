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
	createClient,
	type Client as ToolboxClient,
} from '@snapflow/toolbox-api-client/client';
import {
	EDGE_BACKEND_ACTIVATION_TIMEOUT_MILLISECONDS,
	EdgeAccessSession,
	type EdgeConnection,
	edgeDeadline,
	edgeFetch,
	isSuccessfulResponse,
	retryEdgeRequest,
} from './edge-access-session.js';
import { toSnapflowError } from './errors/error-mapping.js';
import { SnapflowError } from './errors/snapflow-error.js';

const TOOLBOX_READINESS_PATH = '/version';

export type ToolboxConnectionProvider = () => Promise<EdgeConnection>;

export type ToolboxClientProvider = () => Promise<ToolboxClient>;

export interface ToolboxAccess {
	connect: ToolboxConnectionProvider;
	client: ToolboxClientProvider;
}

export class EdgeToolboxSession implements ToolboxAccess {
	private readonly session: EdgeAccessSession;
	private readonly toolboxClient = createToolboxClient();

	constructor(sandboxId: string, client: Client, sdkVersion?: string) {
		this.session = new EdgeAccessSession({
			sandboxId,
			service: SystemExposureService.Toolbox,
			client,
			sdkVersion,
			waitUntilReady: waitForToolboxBackend,
		});
	}

	public connect: ToolboxConnectionProvider = () => this.session.connect();

	public client: ToolboxClientProvider = async () => {
		const connection = await this.connect();
		this.toolboxClient.setConfig({
			baseUrl: connection.baseUrl,
			headers: connection.headers,
		});
		return this.toolboxClient;
	};
}

function createToolboxClient(): ToolboxClient {
	const client = createClient({
		throwOnError: true,
	});
	client.interceptors.error.use(toSnapflowError);
	return client;
}

async function waitForToolboxBackend(
	connection: EdgeConnection,
	sessionExpiresAt: number
): Promise<void> {
	const readinessUrl = new URL(
		TOOLBOX_READINESS_PATH,
		connection.baseUrl
	).toString();
	const response = await retryEdgeRequest({
		deadline: edgeDeadline(
			EDGE_BACKEND_ACTIVATION_TIMEOUT_MILLISECONDS,
			sessionExpiresAt
		),
		timeoutMessage:
			'Toolbox Edge backend did not become ready before the access timeout',
		send: (timeout) =>
			edgeFetch(readinessUrl, { headers: connection.headers }, timeout),
	});
	await response.body?.cancel();
	if (!isSuccessfulResponse(response)) {
		throw new SnapflowError(
			`Toolbox readiness probe was rejected with HTTP ${response.status}`,
			response.status
		);
	}
}
