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
	type Command,
	createSession,
	deleteSession,
	getEntrypointLogs,
	getEntrypointSession,
	getSession,
	getSessionCommand,
	getSessionCommandLogs,
	listSessions,
	type Session,
	type SessionCommandLogsResponse,
	type SessionExecuteRequest,
	type SessionExecuteResponse,
	sendInput,
	sessionExecuteCommand,
} from '@snapflow/toolbox-api-client';
import { requestSignal } from '../utils/http.js';
import { stdDemuxStream } from '../utils/stream.js';
import {
	createSandboxWebSocket,
	createSandboxWebSocketUrl,
} from '../utils/websocket.js';
import { PtySessions } from './pty-sessions.js';

const ENTRYPOINT_LOGS_FOLLOW_PATH =
	'/process/session/entrypoint/logs?follow=true';

const discardOutput = (): void => undefined;

function sessionCommandLogsFollowPath(
	sessionId: string,
	commandId: string
): string {
	return `/process/session/${sessionId}/command/${commandId}/logs?follow=true`;
}

export abstract class ProcessSessions extends PtySessions {
	public async createSession(sessionId: string): Promise<void> {
		await createSession({
			client: await this.toolbox.client(),
			body: { sessionId },
		});
	}

	public async getSession(sessionId: string): Promise<Session> {
		const response = await getSession({
			client: await this.toolbox.client(),
			path: { sessionId },
		});
		return response.data;
	}

	public async getEntrypointSession(): Promise<Session> {
		const response = await getEntrypointSession({
			client: await this.toolbox.client(),
		});
		return response.data;
	}

	public async getSessionCommand(
		sessionId: string,
		commandId: string
	): Promise<Command> {
		const response = await getSessionCommand({
			client: await this.toolbox.client(),
			path: { sessionId, commandId },
		});
		return response.data;
	}

	public async executeSessionCommand(
		sessionId: string,
		req: SessionExecuteRequest,
		timeout?: number
	): Promise<SessionExecuteResponse> {
		const response = await sessionExecuteCommand({
			client: await this.toolbox.client(),
			path: { sessionId },
			body: req,
			signal: requestSignal(timeout),
		});

		return {
			...response.data,
			stdout: response.data.stdout ?? '',
			stderr: response.data.stderr ?? '',
		};
	}

	public async getSessionCommandLogs(
		sessionId: string,
		commandId: string
	): Promise<SessionCommandLogsResponse>;
	public async getSessionCommandLogs(
		sessionId: string,
		commandId: string,
		onStdout: (chunk: string) => void,
		onStderr: (chunk: string) => void
	): Promise<void>;

	public async getSessionCommandLogs(
		sessionId: string,
		commandId: string,
		onStdout?: (chunk: string) => void,
		onStderr?: (chunk: string) => void
		// biome-ignore lint/suspicious/noConfusingVoidType: must stay compatible with the Promise<void> overload
	): Promise<SessionCommandLogsResponse | void> {
		if (!onStdout && !onStderr) {
			const response = await getSessionCommandLogs({
				client: await this.toolbox.client(),
				path: { sessionId, commandId },
			});
			return response.data;
		}

		await this.followLogs(
			sessionCommandLogsFollowPath(sessionId, commandId),
			onStdout,
			onStderr
		);
	}

	public async getEntrypointLogs(): Promise<SessionCommandLogsResponse>;
	public async getEntrypointLogs(
		onStdout: (chunk: string) => void,
		onStderr: (chunk: string) => void
	): Promise<void>;

	public async getEntrypointLogs(
		onStdout?: (chunk: string) => void,
		onStderr?: (chunk: string) => void
		// biome-ignore lint/suspicious/noConfusingVoidType: must stay compatible with the Promise<void> overload
	): Promise<SessionCommandLogsResponse | void> {
		if (!onStdout && !onStderr) {
			const response = await getEntrypointLogs({
				client: await this.toolbox.client(),
			});
			return response.data;
		}

		await this.followLogs(ENTRYPOINT_LOGS_FOLLOW_PATH, onStdout, onStderr);
	}

	public async sendSessionCommandInput(
		sessionId: string,
		commandId: string,
		data: string
	): Promise<void> {
		await sendInput({
			client: await this.toolbox.client(),
			path: { sessionId, commandId },
			body: { data },
		});
	}

	public async listSessions(): Promise<Session[]> {
		const response = await listSessions({
			client: await this.toolbox.client(),
		});
		return response.data;
	}

	public async deleteSession(sessionId: string): Promise<void> {
		await deleteSession({
			client: await this.toolbox.client(),
			path: { sessionId },
		});
	}

	private async followLogs(
		path: string,
		onStdout?: (chunk: string) => void,
		onStderr?: (chunk: string) => void
	): Promise<void> {
		const connection = await this.toolbox.connect();
		const url = createSandboxWebSocketUrl(connection.baseUrl, path);
		const ws = createSandboxWebSocket(url, connection.headers);
		await stdDemuxStream(
			ws,
			onStdout ?? discardOutput,
			onStderr ?? discardOutput
		);
	}
}
