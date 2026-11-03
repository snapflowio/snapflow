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
import type { ToolboxAccess } from './edge-toolbox-session.js';
import {
	SnapflowConnectionError,
	SnapflowTimeoutError,
} from './errors/snapflow-error.js';
import { Process } from './process.js';

const CONNECTED = JSON.stringify({ type: 'control', status: 'connected' });
const PTY_CONNECT_TIMEOUT_MILLISECONDS = 10_000;
const INTERNAL_ERROR_CLOSE_CODE = 1011;
const SESSION_ID = 'pty-session';

interface TestServer {
	server: WebSocketServer;
	toolbox: ToolboxAccess;
	connection: Promise<ServerSocket>;
}

async function startServer(
	onConnection: (socket: ServerSocket) => void
): Promise<TestServer> {
	const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
	const connection = new Promise<ServerSocket>((resolve) => {
		server.on('connection', (socket) => {
			onConnection(socket);
			resolve(socket);
		});
	});
	await once(server, 'listening');
	const address = server.address();
	if (typeof address === 'string') {
		throw new Error('Expected a TCP address');
	}
	const baseUrl = `http://127.0.0.1:${address.port}`;
	return {
		server,
		connection,
		toolbox: {
			connect: async () => ({ baseUrl, headers: {} }),
			client: async () => createClient({ baseUrl }),
		},
	};
}

async function stopServer(server: WebSocketServer): Promise<void> {
	for (const client of server.clients) {
		client.terminate();
	}
	await new Promise<void>((resolve) => server.close(() => resolve()));
}

describe('PtyHandle', () => {
	let testServer: TestServer | undefined;

	afterEach(async () => {
		vi.useRealTimers();
		if (testServer) {
			await stopServer(testServer.server);
			testServer = undefined;
		}
	});

	it('resolves wait with the exit code from the close reason after delivering output', async () => {
		testServer = await startServer((socket) => {
			socket.send(CONNECTED);
			socket.send(Buffer.from('hello'));
			socket.close(
				INTERNAL_ERROR_CLOSE_CODE,
				JSON.stringify({ exitCode: 2, exitReason: 'exited with code 2' })
			);
		});
		const received: string[] = [];
		const handle = await new Process(testServer.toolbox).connectPty(
			SESSION_ID,
			{
				onData: async (data) => {
					received.push(new TextDecoder().decode(data));
				},
			}
		);

		await expect(handle.wait()).resolves.toEqual({
			exitCode: 2,
			error: 'exited with code 2',
		});
		expect(received).toEqual(['hello']);
		expect(handle.exitCode).toBe(2);
	});

	it('rejects wait when the connection drops without an exit status', async () => {
		testServer = await startServer((socket) => {
			socket.send(CONNECTED);
			setImmediate(() => socket.terminate());
		});
		const handle = await new Process(testServer.toolbox).connectPty(
			SESSION_ID,
			{ onData: () => undefined }
		);

		await expect(handle.wait()).rejects.toBeInstanceOf(SnapflowConnectionError);
	});

	it('surfaces onData failures through wait without an unhandled rejection', async () => {
		const unhandled = vi.fn();
		process.on('unhandledRejection', unhandled);
		const failure = new Error('handler failed');
		testServer = await startServer((socket) => {
			socket.send(CONNECTED);
			socket.send(Buffer.from('output'));
		});
		const handle = await new Process(testServer.toolbox).connectPty(
			SESSION_ID,
			{
				onData: () => {
					throw failure;
				},
			}
		);
		const serverSocket = await testServer.connection;

		await expect(handle.wait()).rejects.toBe(failure);
		await once(serverSocket, 'close');
		await new Promise((resolve) => setImmediate(resolve));
		process.off('unhandledRejection', unhandled);
		expect(unhandled).not.toHaveBeenCalled();
	});

	it('closes the socket and clears its timer when the handshake times out', async () => {
		vi.useFakeTimers({
			toFake: [
				'setTimeout',
				'clearTimeout',
				'setInterval',
				'clearInterval',
				'Date',
			],
		});
		testServer = await startServer(() => undefined);
		const connecting = new Process(testServer.toolbox).connectPty(SESSION_ID, {
			onData: () => undefined,
		});
		const serverSocket = await testServer.connection;
		const serverClosed = once(serverSocket, 'close');

		vi.advanceTimersByTime(PTY_CONNECT_TIMEOUT_MILLISECONDS);

		await expect(connecting).rejects.toBeInstanceOf(SnapflowTimeoutError);
		await serverClosed;
		await new Promise((resolve) => setImmediate(resolve));
		expect(vi.getTimerCount()).toBe(0);
	});
});
