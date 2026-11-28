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
	createPtySession,
	deletePtySession,
	getPtySession,
	listPtySessions,
	type PtyCreateRequest,
	type PtySessionInfo,
	resizePtySession,
} from '@snapflow/toolbox-api-client';
import type { ToolboxAccess } from '../edge-toolbox-session.js';
import { PtyHandle } from '../pty-handle.js';
import type { PtyConnectOptions, PtyCreateOptions } from '../types/pty.js';
import {
	createSandboxWebSocket,
	createSandboxWebSocketUrl,
} from '../utils/websocket.js';

export abstract class PtySessions {
	protected constructor(protected readonly toolbox: ToolboxAccess) {}

	public async createPty(
		options: PtyCreateOptions & PtyConnectOptions
	): Promise<PtyHandle> {
		const request: PtyCreateRequest = {
			id: options.id,
			cwd: options.cwd,
			envs: options.envs,
			cols: options.cols,
			rows: options.rows,
			lazyStart: true,
		};

		const response = await createPtySession({
			client: await this.toolbox.client(),
			body: request,
		});

		return await this.connectPty(response.data.sessionId, options);
	}

	public async connectPty(
		sessionId: string,
		options: PtyConnectOptions
	): Promise<PtyHandle> {
		const connection = await this.toolbox.connect();
		const url = createSandboxWebSocketUrl(
			connection.baseUrl,
			`/process/pty/${sessionId}/connect`
		);

		const handle = new PtyHandle(
			createSandboxWebSocket(url, connection.headers),
			(cols: number, rows: number) =>
				this.resizePtySession(sessionId, cols, rows),
			() => this.killPtySession(sessionId),
			options.onData,
			sessionId
		);
		try {
			await handle.waitForConnection();
		} catch (error) {
			await handle.disconnect();
			throw error;
		}
		return handle;
	}

	public async listPtySessions(): Promise<PtySessionInfo[]> {
		return (await listPtySessions({ client: await this.toolbox.client() })).data
			.sessions;
	}

	public async getPtySessionInfo(sessionId: string): Promise<PtySessionInfo> {
		return (
			await getPtySession({
				client: await this.toolbox.client(),
				path: { sessionId },
			})
		).data;
	}

	public async killPtySession(sessionId: string): Promise<void> {
		await deletePtySession({
			client: await this.toolbox.client(),
			path: { sessionId },
		});
	}

	public async resizePtySession(
		sessionId: string,
		cols: number,
		rows: number
	): Promise<PtySessionInfo> {
		return (
			await resizePtySession({
				client: await this.toolbox.client(),
				path: { sessionId },
				body: { cols, rows },
			})
		).data;
	}
}
