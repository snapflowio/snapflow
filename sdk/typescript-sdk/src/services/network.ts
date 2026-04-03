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

/*
 * Copyright 2025 Snapflow
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Configuration as ToolboxConfiguration } from '@snapflow/toolbox-client';
import type { AxiosInstance } from 'axios';
import WebSocket from 'ws';

export interface DnsEvent {
	type: 'dns';
	domain: string;
	queryType: string;
	resolvedIps: string[];
	timestamp: string;
}

export interface HttpEvent {
	type: 'http';
	method: string;
	url: string;
	host: string;
	port: number;
	tls: boolean;
	requestHeaders: Record<string, string>;
	requestBody?: string;
	statusCode?: number;
	responseHeaders?: Record<string, string>;
	responseBody?: string;
	durationMs: number;
	timestamp: string;
}

export type NetworkEvent = DnsEvent | HttpEvent;

export interface NetworkStream {
	onDns(handler: (event: DnsEvent) => void): void;
	onHttp(handler: (event: HttpEvent) => void): void;
	onEvent(handler: (event: NetworkEvent) => void): void;
	onError(handler: (error: Error) => void): void;
	onClose(handler: () => void): void;
	close(): void;
}

export class Network {
	constructor(
		private readonly toolboxConfig: ToolboxConfiguration,
		private readonly axiosInstance: AxiosInstance
	) {}

	async getEvents(): Promise<NetworkEvent[]> {
		const basePath = this.toolboxConfig.basePath ?? '';
		const response = await this.axiosInstance.get(
			`${basePath}/network/events`,
			{
				headers: this.toolboxConfig.baseOptions?.headers,
			}
		);

		return response.data.events ?? [];
	}

	stream(): NetworkStream {
		const basePath = (this.toolboxConfig.basePath ?? '').replace(/^http/, 'ws');
		const headers = this.toolboxConfig.baseOptions?.headers ?? {};
		const ws = new WebSocket(`${basePath}/network/stream`, { headers });

		const dnsHandlers: ((event: DnsEvent) => void)[] = [];
		const httpHandlers: ((event: HttpEvent) => void)[] = [];
		const eventHandlers: ((event: NetworkEvent) => void)[] = [];
		const errorHandlers: ((error: Error) => void)[] = [];
		const closeHandlers: (() => void)[] = [];

		ws.on('message', (data: WebSocket.Data) => {
			try {
				const event: NetworkEvent = JSON.parse(data.toString());
				for (const handler of eventHandlers) handler(event);
				if (event.type === 'dns') {
					for (const handler of dnsHandlers) handler(event);
				} else if (event.type === 'http') {
					for (const handler of httpHandlers) handler(event);
				}
			} catch {
				// malformed message
			}
		});

		ws.on('error', (err: Error) => {
			for (const handler of errorHandlers) handler(err);
		});

		ws.on('close', () => {
			for (const handler of closeHandlers) handler();
			dnsHandlers.length = 0;
			httpHandlers.length = 0;
			eventHandlers.length = 0;
			errorHandlers.length = 0;
			closeHandlers.length = 0;
		});

		return {
			onDns(handler: (event: DnsEvent) => void) {
				dnsHandlers.push(handler);
			},
			onHttp(handler: (event: HttpEvent) => void) {
				httpHandlers.push(handler);
			},
			onEvent(handler: (event: NetworkEvent) => void) {
				eventHandlers.push(handler);
			},
			onError(handler: (error: Error) => void) {
				errorHandlers.push(handler);
			},
			onClose(handler: () => void) {
				closeHandlers.push(handler);
			},
			close() {
				ws.close();
			},
		};
	}
}
