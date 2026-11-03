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

import type { PtySessionInfo } from '@snapflow/toolbox-api-client';
import WebSocket from 'isomorphic-ws';
import {
	SnapflowConnectionError,
	SnapflowError,
	SnapflowTimeoutError,
} from './errors/snapflow-error.js';
import type { PtyResult } from './types/pty.js';
import { parseJsonRecord } from './utils/record.js';
import {
	closeWebSocket,
	describeWebSocketClose,
	listenWebSocket,
	WEB_SOCKET_NORMAL_CLOSURE,
	webSocketErrorMessage,
	webSocketMessageBytes,
} from './utils/websocket.js';

const PTY_CONNECT_TIMEOUT_MILLISECONDS = 10_000;
const CONTROL_MESSAGE_TYPE = 'control';
const CONTROL_STATUS_CONNECTED = 'connected';
const SUCCESS_EXIT_CODE = 0;

type PtyState = 'connecting' | 'connected' | 'closed';

type PtyOutcome =
	| { exited: true; result: PtyResult }
	| { exited: false; error: Error };

function isConnectedControlMessage(text: string): boolean {
	const message = parseJsonRecord(text);
	return (
		message?.type === CONTROL_MESSAGE_TYPE &&
		message.status === CONTROL_STATUS_CONNECTED
	);
}

function parseExitResult(reason: string): PtyResult | undefined {
	const payload = parseJsonRecord(reason);
	if (typeof payload?.exitCode !== 'number') {
		return undefined;
	}
	return {
		exitCode: payload.exitCode,
		error:
			typeof payload.exitReason === 'string' ? payload.exitReason : undefined,
	};
}

function closeOutcome(event: WebSocket.CloseEvent): PtyOutcome {
	const result = parseExitResult(event.reason);
	if (result) {
		return { exited: true, result };
	}
	if (event.code === WEB_SOCKET_NORMAL_CLOSURE) {
		return { exited: true, result: { exitCode: SUCCESS_EXIT_CODE } };
	}
	return {
		exited: false,
		error: new SnapflowConnectionError(
			`PTY connection closed unexpectedly (${describeWebSocketClose(event)})`
		),
	};
}

function toError(error: unknown): Error {
	return error instanceof Error
		? error
		: new SnapflowError(`PTY data handler failed: ${String(error)}`);
}

export class PtyHandle {
	private state: PtyState = 'connecting';
	private _exitCode?: number;
	private _error?: string;
	private readonly connection = Promise.withResolvers<Error | undefined>();
	private readonly outcome = Promise.withResolvers<PtyOutcome>();
	private delivery: Promise<void> = Promise.resolve();
	private failed = false;
	private settled = false;

	constructor(
		private readonly ws: WebSocket,
		private readonly handleResize: (
			cols: number,
			rows: number
		) => Promise<PtySessionInfo>,
		private readonly handleKill: () => Promise<void>,
		private readonly onPty: (data: Uint8Array) => void | Promise<void>,
		readonly sessionId: string
	) {
		listenWebSocket(ws, {
			message: (event) => this.handleMessage(event.data),
			close: (event) => this.handleClose(event),
			error: (event) =>
				this.fail(new SnapflowConnectionError(webSocketErrorMessage(event))),
		});
	}

	get exitCode(): number | undefined {
		return this._exitCode;
	}

	get error(): string | undefined {
		return this._error;
	}

	isConnected(): boolean {
		return this.state === 'connected' && this.ws.readyState === WebSocket.OPEN;
	}

	async waitForConnection(): Promise<void> {
		const timer = setTimeout(
			() =>
				this.connection.resolve(
					new SnapflowTimeoutError('PTY connection timeout')
				),
			PTY_CONNECT_TIMEOUT_MILLISECONDS
		);
		const failure = await this.connection.promise;
		clearTimeout(timer);
		if (failure) {
			throw failure;
		}
	}

	async sendInput(data: string | Uint8Array): Promise<void> {
		if (!this.isConnected()) {
			throw new SnapflowConnectionError('PTY is not connected');
		}

		try {
			this.ws.send(
				typeof data === 'string' ? new TextEncoder().encode(data) : data
			);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			throw new SnapflowConnectionError(
				`Failed to send input to PTY: ${errorMessage}`
			);
		}
	}

	async resize(cols: number, rows: number): Promise<PtySessionInfo> {
		return await this.handleResize(cols, rows);
	}

	async disconnect(): Promise<void> {
		closeWebSocket(this.ws);
	}

	async wait(): Promise<PtyResult> {
		const outcome = await this.outcome.promise;
		if (!outcome.exited) {
			throw outcome.error;
		}
		return outcome.result;
	}

	async kill(): Promise<void> {
		return await this.handleKill();
	}

	private handleMessage(data: WebSocket.Data): void {
		if (this.failed) {
			return;
		}
		if (typeof data === 'string' && isConnectedControlMessage(data)) {
			this.state = 'connected';
			this.connection.resolve(undefined);
			return;
		}
		const bytes = webSocketMessageBytes(data);
		this.delivery = this.delivery
			.then(() => this.deliver(bytes))
			.catch((error: unknown) => this.fail(toError(error)));
	}

	private async deliver(bytes: Uint8Array): Promise<void> {
		if (!this.failed) {
			await this.onPty(bytes);
		}
	}

	private handleClose(event: WebSocket.CloseEvent): void {
		this.state = 'closed';
		this.connection.resolve(
			new SnapflowConnectionError(
				`PTY connection closed before it was established (${describeWebSocketClose(event)})`
			)
		);
		this.delivery = this.delivery.then(() => this.settle(closeOutcome(event)));
	}

	private fail(error: Error): void {
		this.failed = true;
		this.state = 'closed';
		this.connection.resolve(error);
		this.settle({ exited: false, error });
		closeWebSocket(this.ws);
	}

	private settle(outcome: PtyOutcome): void {
		if (this.settled) {
			return;
		}
		this.settled = true;
		if (outcome.exited) {
			this._exitCode = outcome.result.exitCode;
			this._error = outcome.result.error;
		} else {
			this._error = outcome.error.message;
		}
		this.outcome.resolve(outcome);
	}
}
