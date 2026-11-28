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

import WebSocket from 'isomorphic-ws';
import { SnapflowValidationError } from '../errors/snapflow-error.js';
import { concatUint8Arrays } from './binary.js';
import {
	EDGE_ACCESS_TOKEN_HEADER,
	EDGE_ACCESS_TOKEN_PROTOCOL_PREFIX,
} from './edge-access.js';
import { RUNTIME, Runtime } from './runtime.js';

const HTTP_PROTOCOL_PATTERN = /^http/;
const BINARY_TYPE = 'arraybuffer';
const DEFAULT_ERROR_MESSAGE = 'WebSocket connection error';

export const WEB_SOCKET_NORMAL_CLOSURE = 1000;
export const WEB_SOCKET_TIMEOUT_CLOSURE = 4008;

export interface WebSocketListeners {
	open?: () => void;
	message?: (event: WebSocket.MessageEvent) => void;
	close: (event: WebSocket.CloseEvent) => void;
	error: (event: WebSocket.ErrorEvent) => void;
}

export function createSandboxWebSocketUrl(
	basePath: string | undefined,
	path: string
): string {
	const normalizedBasePath = basePath?.trim();
	if (!normalizedBasePath) {
		throw new SnapflowValidationError(
			'Sandbox toolbox base URL is not configured'
		);
	}

	return `${normalizedBasePath.replace(HTTP_PROTOCOL_PATTERN, 'ws')}${path}`;
}

export function createSandboxWebSocket(
	url: string,
	headers: Readonly<Record<string, string>>
): WebSocket {
	const ws = canSetWebSocketHeaders()
		? new WebSocket(url, { headers })
		: new WebSocket(url, accessTokenProtocols(headers));
	ws.binaryType = BINARY_TYPE;
	return ws;
}

function canSetWebSocketHeaders(): boolean {
	return (
		RUNTIME !== Runtime.BROWSER &&
		RUNTIME !== Runtime.DENO &&
		RUNTIME !== Runtime.SERVERLESS
	);
}

function accessTokenProtocols(
	headers: Readonly<Record<string, string>>
): string[] {
	const token = headers[EDGE_ACCESS_TOKEN_HEADER];
	return token ? [`${EDGE_ACCESS_TOKEN_PROTOCOL_PREFIX}${token}`] : [];
}

export function listenWebSocket(
	ws: WebSocket,
	listeners: WebSocketListeners
): void {
	const { open, message, close, error } = listeners;
	if (open) ws.addEventListener('open', open);
	if (message) ws.addEventListener('message', message);
	ws.addEventListener('close', close);
	ws.addEventListener('error', error);
}

export function webSocketMessageBytes(data: WebSocket.Data): Uint8Array {
	if (typeof data === 'string') {
		return new TextEncoder().encode(data);
	}
	if (data instanceof ArrayBuffer) {
		return new Uint8Array(data);
	}
	if (Array.isArray(data)) {
		return concatUint8Arrays(data);
	}
	return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

export function webSocketMessageText(data: WebSocket.Data): string {
	return typeof data === 'string'
		? data
		: new TextDecoder().decode(webSocketMessageBytes(data));
}

export function webSocketErrorMessage(event: WebSocket.ErrorEvent): string {
	return event.message || DEFAULT_ERROR_MESSAGE;
}

export function describeWebSocketClose(event: WebSocket.CloseEvent): string {
	return event.reason
		? `close code ${event.code}: ${event.reason}`
		: `close code ${event.code}`;
}

export function closeWebSocket(ws: WebSocket): void {
	if (
		ws.readyState === WebSocket.CONNECTING ||
		ws.readyState === WebSocket.OPEN
	) {
		ws.close();
	}
}
