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

import { once } from 'node:events';
import { createClient } from '@snapflow/toolbox-api-client/client';
import { type WebSocket as ServerSocket, WebSocketServer } from 'ws';
import { CodeInterpreter } from './code-interpreter.js';
import {
	SnapflowError,
	SnapflowTimeoutError,
} from './errors/snapflow-error.js';

const RUN_CODE_TIMEOUT_SECONDS = 1;
const DEADLINE_GRACE_MILLISECONDS = 30_000;

function chunk(type: string, text: string): string {
	return JSON.stringify({ type, text });
}

describe('CodeInterpreter.runCode', () => {
	let server: WebSocketServer | undefined;

	async function interpreter(
		onRequest: (socket: ServerSocket, request: unknown) => void
	): Promise<CodeInterpreter> {
		server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
		server.on('connection', (socket) => {
			socket.once('message', (data) =>
				onRequest(socket, JSON.parse(data.toString()))
			);
		});
		await once(server, 'listening');
		const address = server.address();
		if (typeof address === 'string') {
			throw new Error('Expected a TCP address');
		}
		const baseUrl = `http://127.0.0.1:${address.port}`;
		return new CodeInterpreter({
			connect: async () => ({ baseUrl, headers: {} }),
			client: async () => createClient({ baseUrl }),
		});
	}

	afterEach(async () => {
		vi.useRealTimers();
		if (server) {
			for (const client of server.clients) {
				client.terminate();
			}
			const closing = server;
			await new Promise<void>((resolve) => closing.close(() => resolve()));
			server = undefined;
		}
	});

	it('collects output in order and sends the request', async () => {
		const requests: unknown[] = [];
		const codeInterpreter = await interpreter((socket, request) => {
			requests.push(request);
			socket.send(chunk('stdout', 'a'));
			socket.send(chunk('stderr', 'b'));
			socket.send(chunk('control', 'completed'));
		});
		const stdout: string[] = [];

		const result = await codeInterpreter.runCode('print(1)', {
			timeout: RUN_CODE_TIMEOUT_SECONDS,
			onStdout: async ({ output }) => {
				stdout.push(output);
			},
		});

		expect(result).toEqual({ stdout: 'a', stderr: 'b' });
		expect(stdout).toEqual(['a']);
		expect(requests).toEqual([
			{ code: 'print(1)', timeout: RUN_CODE_TIMEOUT_SECONDS },
		]);
	});

	it('rejects with the error thrown by an output callback', async () => {
		const failure = new Error('callback failed');
		const codeInterpreter = await interpreter((socket) => {
			socket.send(chunk('stdout', 'a'));
			socket.send(chunk('control', 'completed'));
		});

		await expect(
			codeInterpreter.runCode('print(1)', {
				onStdout: () => {
					throw failure;
				},
			})
		).rejects.toBe(failure);
	});

	it('rejects malformed output', async () => {
		const codeInterpreter = await interpreter((socket) => {
			socket.send('not json');
		});

		await expect(codeInterpreter.runCode('print(1)')).rejects.toBeInstanceOf(
			SnapflowError
		);
	});

	it('rejects when the sandbox never finishes the execution', async () => {
		vi.useFakeTimers({
			toFake: [
				'setTimeout',
				'clearTimeout',
				'setInterval',
				'clearInterval',
				'Date',
			],
		});
		const requested = Promise.withResolvers<void>();
		const codeInterpreter = await interpreter(() => requested.resolve());

		const running = codeInterpreter.runCode('while True: pass', {
			timeout: RUN_CODE_TIMEOUT_SECONDS,
		});
		await requested.promise;
		vi.advanceTimersByTime(
			RUN_CODE_TIMEOUT_SECONDS * 1000 + DEADLINE_GRACE_MILLISECONDS
		);

		await expect(running).rejects.toBeInstanceOf(SnapflowTimeoutError);
	});
});
