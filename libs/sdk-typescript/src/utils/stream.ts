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

import type WebSocket from 'isomorphic-ws';
import { SnapflowConnectionError } from '../errors/snapflow-error.js';
import {
	MAX_PREFIX_LEN,
	STDERR_PREFIX_BYTE,
	STDOUT_PREFIX_BYTE,
} from '../process.types.js';
import { concatUint8Arrays } from './binary.js';
import {
	closeWebSocket,
	describeWebSocketClose,
	listenWebSocket,
	WEB_SOCKET_NORMAL_CLOSURE,
	webSocketErrorMessage,
	webSocketMessageBytes,
} from './websocket.js';

type OutputStream = 'stdout' | 'stderr';

interface PrefixMatch {
	index: number;
	stream: OutputStream;
}

const PREFIX_STREAMS: ReadonlyMap<number, OutputStream> = new Map([
	[STDOUT_PREFIX_BYTE, 'stdout'],
	[STDERR_PREFIX_BYTE, 'stderr'],
]);
const HELD_BYTES = MAX_PREFIX_LEN - 1;
const EMPTY_BYTES = new Uint8Array(0);

function isRepeatedByte(data: Uint8Array, index: number): boolean {
	for (let offset = 1; offset < MAX_PREFIX_LEN; offset++) {
		if (data[index + offset] !== data[index]) {
			return false;
		}
	}
	return true;
}

function findPrefix(data: Uint8Array, from: number): PrefixMatch | undefined {
	for (let index = from; index + MAX_PREFIX_LEN <= data.length; index++) {
		const stream = PREFIX_STREAMS.get(data[index]);
		if (stream && isRepeatedByte(data, index)) {
			return { index, stream };
		}
	}
	return undefined;
}

export class StdDemuxer {
	private current: OutputStream | undefined;
	private pending = EMPTY_BYTES;
	private readonly decoders: Record<OutputStream, TextDecoder> = {
		stdout: new TextDecoder(),
		stderr: new TextDecoder(),
	};
	private readonly sinks: Record<OutputStream, (text: string) => void>;

	constructor(
		onStdout: (text: string) => void,
		onStderr: (text: string) => void
	) {
		this.sinks = { stdout: onStdout, stderr: onStderr };
	}

	push(chunk: Uint8Array): void {
		const data =
			this.pending.length === 0
				? chunk
				: concatUint8Arrays([this.pending, chunk]);
		let start = 0;
		for (
			let prefix = findPrefix(data, start);
			prefix;
			prefix = findPrefix(data, start)
		) {
			this.emit(data.subarray(start, prefix.index));
			this.current = prefix.stream;
			start = prefix.index + MAX_PREFIX_LEN;
		}
		const end = data.length - Math.min(HELD_BYTES, data.length - start);
		this.emit(data.subarray(start, end));
		this.pending = data.slice(end);
	}

	flush(): void {
		this.emit(this.pending);
		this.pending = EMPTY_BYTES;
		for (const stream of ['stdout', 'stderr'] as const) {
			const text = this.decoders[stream].decode();
			if (text) {
				this.sinks[stream](text);
			}
		}
	}

	private emit(bytes: Uint8Array): void {
		if (!this.current || bytes.length === 0) {
			return;
		}
		const text = this.decoders[this.current].decode(bytes, { stream: true });
		if (text) {
			this.sinks[this.current](text);
		}
	}
}

export function stdDemuxStream(
	ws: WebSocket,
	onStdout: (data: string) => void,
	onStderr: (data: string) => void
): Promise<void> {
	return new Promise((resolve, reject) => {
		const demuxer = new StdDemuxer(onStdout, onStderr);
		let settled = false;

		const fail = (error: unknown) => {
			if (settled) return;
			settled = true;
			closeWebSocket(ws);
			reject(error);
		};

		const finish = (event: WebSocket.CloseEvent) => {
			demuxer.flush();
			if (event.code !== WEB_SOCKET_NORMAL_CLOSURE) {
				throw new SnapflowConnectionError(
					`Log stream closed unexpectedly (${describeWebSocketClose(event)})`
				);
			}
			settled = true;
			resolve();
		};

		listenWebSocket(ws, {
			message: (event) => {
				if (settled) return;
				try {
					demuxer.push(webSocketMessageBytes(event.data));
				} catch (error) {
					fail(error);
				}
			},
			close: (event) => {
				if (settled) return;
				try {
					finish(event);
				} catch (error) {
					fail(error);
				}
			},
			error: (event) => {
				fail(
					new SnapflowConnectionError(
						`Log stream failed: ${webSocketErrorMessage(event)}`
					)
				);
			},
		});
	});
}
