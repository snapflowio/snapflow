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
import { type WebSocket as ServerSocket, WebSocketServer } from 'ws';
import { SnapflowConnectionError } from '../errors/snapflow-error.js';
import { STDERR_PREFIX_BYTES, STDOUT_PREFIX_BYTES } from '../process.types.js';
import { concatUint8Arrays } from './binary.js';
import { StdDemuxer, stdDemuxStream } from './stream.js';
import { createSandboxWebSocket } from './websocket.js';

const encoder = new TextEncoder();
const LARGE_FRAME_BYTES = 4 * 1024 * 1024;
const NORMAL_CLOSE_CODE = 1000;
const INTERNAL_ERROR_CLOSE_CODE = 1011;

function frame(prefix: Uint8Array, text: string): Uint8Array {
	return concatUint8Arrays([prefix, encoder.encode(text)]);
}

function collect() {
	const output = { stdout: '', stderr: '' };
	const demuxer = new StdDemuxer(
		(text) => {
			output.stdout += text;
		},
		(text) => {
			output.stderr += text;
		}
	);
	return { output, demuxer };
}

async function withServer(
	onConnection: (socket: ServerSocket) => void,
	run: (url: string) => Promise<void>
): Promise<void> {
	const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
	server.on('connection', onConnection);
	await once(server, 'listening');
	const address = server.address();
	if (typeof address === 'string') {
		throw new Error('Expected a TCP address');
	}
	try {
		await run(`ws://127.0.0.1:${address.port}`);
	} finally {
		for (const client of server.clients) {
			client.terminate();
		}
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
}

describe('StdDemuxer', () => {
	it('routes output when prefixes and multi-byte characters span chunks', () => {
		const { output, demuxer } = collect();
		const bytes = concatUint8Arrays([
			frame(STDOUT_PREFIX_BYTES, 'out ✓'),
			frame(STDERR_PREFIX_BYTES, 'err'),
			frame(STDOUT_PREFIX_BYTES, 'tail'),
		]);
		for (let index = 0; index < bytes.length; index++) {
			demuxer.push(bytes.subarray(index, index + 1));
		}
		demuxer.flush();

		expect(output).toEqual({ stdout: 'out ✓tail', stderr: 'err' });
	});

	it('demuxes frames of several megabytes', () => {
		const { output, demuxer } = collect();
		const large = 'x'.repeat(LARGE_FRAME_BYTES);

		demuxer.push(frame(STDOUT_PREFIX_BYTES, large));
		demuxer.push(frame(STDERR_PREFIX_BYTES, large));
		demuxer.flush();

		expect(output.stdout).toHaveLength(LARGE_FRAME_BYTES);
		expect(output.stderr).toHaveLength(LARGE_FRAME_BYTES);
	});
});

describe('stdDemuxStream', () => {
	it('resolves with all output on a normal closure', async () => {
		await withServer(
			(socket) => {
				socket.send(frame(STDOUT_PREFIX_BYTES, 'done'));
				socket.close(NORMAL_CLOSE_CODE);
			},
			async (url) => {
				const stdout: string[] = [];
				await stdDemuxStream(
					createSandboxWebSocket(url, {}),
					(text) => stdout.push(text),
					() => undefined
				);
				expect(stdout.join('')).toBe('done');
			}
		);
	});

	it('rejects when the stream closes with an error code', async () => {
		await withServer(
			(socket) => socket.close(INTERNAL_ERROR_CLOSE_CODE, 'log failure'),
			async (url) => {
				await expect(
					stdDemuxStream(
						createSandboxWebSocket(url, {}),
						() => undefined,
						() => undefined
					)
				).rejects.toThrow(SnapflowConnectionError);
			}
		);
	});

	it('rejects when the connection drops', async () => {
		await withServer(
			(socket) => {
				socket.send(frame(STDOUT_PREFIX_BYTES, 'partial'));
				setImmediate(() => socket.terminate());
			},
			async (url) => {
				await expect(
					stdDemuxStream(
						createSandboxWebSocket(url, {}),
						() => undefined,
						() => undefined
					)
				).rejects.toThrow(SnapflowConnectionError);
			}
		);
	});
});
