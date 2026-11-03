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
	createInterpreterContext,
	deleteInterpreterContext,
	type InterpreterContext,
	listInterpreterContexts,
} from '@snapflow/toolbox-api-client';
import type WebSocket from 'isomorphic-ws';
import type { ToolboxAccess } from './edge-toolbox-session.js';
import {
	SnapflowConnectionError,
	SnapflowError,
	SnapflowTimeoutError,
	SnapflowValidationError,
} from './errors/snapflow-error.js';
import type {
	ExecutionError,
	ExecutionResult,
	RunCodeOptions,
} from './types/code-interpreter.js';
import { isRecord, optionalString } from './utils/record.js';
import { assertNonNegativeTimeout, toMilliseconds } from './utils/timeout.js';
import {
	closeWebSocket,
	createSandboxWebSocket,
	createSandboxWebSocketUrl,
	describeWebSocketClose,
	listenWebSocket,
	WEB_SOCKET_NORMAL_CLOSURE,
	WEB_SOCKET_TIMEOUT_CLOSURE,
	webSocketErrorMessage,
	webSocketMessageText,
} from './utils/websocket.js';

const EXECUTE_PATH = '/process/interpreter/execute';
const DEFAULT_RUN_CODE_TIMEOUT_SECONDS = 600;
const RUN_CODE_DEADLINE_GRACE_SECONDS = 30;
const COMPLETED_CONTROL_TEXTS: ReadonlySet<string> = new Set([
	'completed',
	'interrupted',
]);

interface ExecuteRequest {
	code: string;
	contextId?: string;
	envs?: Record<string, string>;
	timeout: number;
}

type ExecutionChunk =
	| { type: 'stdout'; text: string }
	| { type: 'stderr'; text: string }
	| { type: 'error'; error: ExecutionError }
	| { type: 'control'; text: string };

function parseExecutionChunk(text: string): ExecutionChunk {
	let payload: unknown;
	try {
		payload = JSON.parse(text);
	} catch (error) {
		throw new SnapflowError(
			`Received malformed interpreter output: ${error instanceof Error ? error.message : String(error)}`
		);
	}
	if (!isRecord(payload)) {
		throw new SnapflowError('Received malformed interpreter output');
	}
	const chunkText = optionalString(payload.text) ?? '';
	switch (payload.type) {
		case 'stdout':
		case 'stderr':
		case 'control':
			return { type: payload.type, text: chunkText };
		case 'error':
			return {
				type: 'error',
				error: {
					name: optionalString(payload.name) ?? '',
					value: optionalString(payload.value) ?? '',
					traceback: optionalString(payload.traceback) ?? '',
				},
			};
		default:
			throw new SnapflowError(
				`Received unknown interpreter output type: ${String(payload.type)}`
			);
	}
}

async function applyChunk(
	result: ExecutionResult,
	chunk: ExecutionChunk,
	options: RunCodeOptions
): Promise<boolean> {
	switch (chunk.type) {
		case 'stdout':
			result.stdout += chunk.text;
			await options.onStdout?.({ output: chunk.text });
			return false;
		case 'stderr':
			result.stderr += chunk.text;
			await options.onStderr?.({ output: chunk.text });
			return false;
		case 'error':
			result.error = chunk.error;
			await options.onError?.(chunk.error);
			return false;
		case 'control':
			if (!COMPLETED_CONTROL_TEXTS.has(chunk.text)) {
				throw new SnapflowError(
					`Received unknown interpreter control message: ${chunk.text}`
				);
			}
			return true;
	}
}

function closeError(event: WebSocket.CloseEvent): SnapflowError {
	if (event.code === WEB_SOCKET_TIMEOUT_CLOSURE) {
		return new SnapflowTimeoutError(
			'Execution timed out: operation exceeded the configured `timeout`. Provide a larger value if needed.'
		);
	}
	return new SnapflowConnectionError(
		`Code execution failed: WebSocket closed (${describeWebSocketClose(event)})`
	);
}

function executeRequest(
	code: string,
	options: RunCodeOptions,
	timeout: number
): ExecuteRequest {
	return {
		code,
		contextId: options.context?.id,
		envs: options.envs,
		timeout,
	};
}

function runExecution(
	ws: WebSocket,
	request: ExecuteRequest,
	options: RunCodeOptions
): Promise<ExecutionResult> {
	return new Promise<ExecutionResult>((resolve, reject) => {
		const result: ExecutionResult = { stdout: '', stderr: '' };
		let settled = false;
		let deadline: ReturnType<typeof setTimeout> | undefined;
		let processing: Promise<void> = Promise.resolve();

		const finish = (): boolean => {
			if (settled) return false;
			settled = true;
			clearTimeout(deadline);
			closeWebSocket(ws);
			return true;
		};
		const succeed = () => {
			if (finish()) resolve(result);
		};
		const fail = (error: unknown) => {
			if (finish()) reject(error);
		};

		if (request.timeout !== 0) {
			deadline = setTimeout(
				() =>
					fail(
						new SnapflowTimeoutError(
							'Execution timed out: the sandbox did not finish the execution in time'
						)
					),
				toMilliseconds(request.timeout + RUN_CODE_DEADLINE_GRACE_SECONDS)
			);
		}

		const enqueue = (step: () => Promise<void> | void) => {
			processing = processing
				.then(async () => {
					if (!settled) await step();
				})
				.catch(fail);
		};

		listenWebSocket(ws, {
			open: () => ws.send(JSON.stringify(request)),
			message: (event) => {
				const text = webSocketMessageText(event.data);
				enqueue(async () => {
					if (await applyChunk(result, parseExecutionChunk(text), options)) {
						succeed();
					}
				});
			},
			close: (event) => {
				enqueue(() =>
					event.code === WEB_SOCKET_NORMAL_CLOSURE
						? succeed()
						: fail(closeError(event))
				);
			},
			error: (event) => {
				fail(
					new SnapflowConnectionError(
						`Failed to execute code: ${webSocketErrorMessage(event)}`
					)
				);
			},
		});
	});
}

export class CodeInterpreter {
	constructor(private readonly toolbox: ToolboxAccess) {}

	public async runCode(
		code: string,
		options: RunCodeOptions = {}
	): Promise<ExecutionResult> {
		if (!code?.trim()) {
			throw new SnapflowValidationError('Code is required for execution');
		}
		const timeout = options.timeout ?? DEFAULT_RUN_CODE_TIMEOUT_SECONDS;
		assertNonNegativeTimeout(timeout);

		const connection = await this.toolbox.connect();
		const ws = createSandboxWebSocket(
			createSandboxWebSocketUrl(connection.baseUrl, EXECUTE_PATH),
			connection.headers
		);
		return await runExecution(
			ws,
			executeRequest(code, options, timeout),
			options
		);
	}

	public async createContext(cwd?: string): Promise<InterpreterContext> {
		return (
			await createInterpreterContext({
				client: await this.toolbox.client(),
				body: { cwd },
			})
		).data;
	}

	public async listContexts(): Promise<InterpreterContext[]> {
		const response = await listInterpreterContexts({
			client: await this.toolbox.client(),
		});
		return response.data.contexts ?? [];
	}

	public async deleteContext(context: InterpreterContext): Promise<void> {
		await deleteInterpreterContext({
			client: await this.toolbox.client(),
			path: { id: context.id },
		});
	}
}
