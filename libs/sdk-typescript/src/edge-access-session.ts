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
	createProtectedAccessGrant,
	requestSystemExposure,
	type SystemExposureService,
} from '@snapflow/api-client';
import type { Client } from '@snapflow/api-client/client';
import {
	createRequestSnapflowError,
	SnapflowAuthenticationError,
	SnapflowError,
	SnapflowTimeoutError,
	SnapflowValidationError,
} from './errors/snapflow-error.js';
import { SDK_VERSION_HEADER } from './snapflow/client-config.js';
import { abortableDelay } from './utils/async.js';
import {
	EDGE_ACCESS_MODE_HEADER,
	EDGE_ACCESS_TOKEN_HEADER,
	EDGE_ACCESS_TOKEN_MODE,
} from './utils/edge-access.js';
import { resolveIdempotencyKey } from './utils/idempotency.js';

const EDGE_SESSION_DURATION_MINUTES = 60;
const SECONDS_PER_MINUTE = 60;
const EDGE_SESSION_DURATION_SECONDS =
	EDGE_SESSION_DURATION_MINUTES * SECONDS_PER_MINUTE;
const EDGE_SESSION_REFRESH_SKEW_MILLISECONDS = 5_000;
const EDGE_SESSION_REDEMPTION_TIMEOUT_MILLISECONDS = 30_000;
const EDGE_RETRY_FALLBACK_MILLISECONDS = 1_000;
const EDGE_RETRY_MAXIMUM_MILLISECONDS = 2_000;
const MILLISECONDS_PER_SECOND = 1_000;
const MINIMUM_REQUEST_TIMEOUT_MILLISECONDS = 1;
const HTTP_SUCCESS_LOWER_BOUND = 200;
const HTTP_SUCCESS_UPPER_BOUND = 300;
const HTTP_BAD_GATEWAY_STATUS = 502;
const HTTP_SERVICE_UNAVAILABLE_STATUS = 503;
const EDGE_ERROR_HEADER = 'x-snapflow-edge-error';
const EDGE_NO_READY_BACKEND_ERROR = 'no_ready_backend';
const EDGE_TARGET_UNAVAILABLE_ERROR = 'target_unavailable';
const EDGE_UPSTREAM_UNAVAILABLE_ERROR = 'upstream_unavailable';
const RETRY_AFTER_HEADER = 'retry-after';
const SECURE_PROTOCOL = 'https:';
export const EDGE_BACKEND_ACTIVATION_TIMEOUT_MILLISECONDS = 30_000;

export interface EdgeConnection {
	baseUrl: string;
	headers: Readonly<Record<string, string>>;
}

export interface EdgeAccessSessionOptions {
	sandboxId: string;
	service: SystemExposureService;
	client: Client;
	sdkVersion?: string;
	waitUntilReady?: (
		connection: EdgeConnection,
		sessionExpiresAt: number
	) => Promise<void>;
}

export class EdgeAccessSession {
	private connection?: EdgeConnection;
	private expiresAtMilliseconds = 0;
	private pendingConnection?: Promise<EdgeConnection>;

	constructor(private readonly options: EdgeAccessSessionOptions) {}

	public connect = async (): Promise<EdgeConnection> => {
		if (this.connection && this.hasCurrentSession()) return this.connection;
		if (!this.pendingConnection) {
			this.pendingConnection = this.establish().finally(() => {
				this.pendingConnection = undefined;
			});
		}
		return this.pendingConnection;
	};

	private hasCurrentSession(): boolean {
		return (
			this.expiresAtMilliseconds - EDGE_SESSION_REFRESH_SKEW_MILLISECONDS >
			Date.now()
		);
	}

	private async establish(): Promise<EdgeConnection> {
		const { client, sandboxId, service } = this.options;
		const exposure = (
			await requestSystemExposure({
				client,
				path: { sandboxId, service },
				headers: { 'Idempotency-Key': resolveIdempotencyKey() },
				body: { durationSeconds: EDGE_SESSION_DURATION_SECONDS },
			})
		).data;
		const grant = (
			await createProtectedAccessGrant({
				client,
				path: { sandboxId, exposureId: exposure.id },
				headers: { 'Idempotency-Key': resolveIdempotencyKey() },
				body: { sessionLifetimeSeconds: EDGE_SESSION_DURATION_SECONDS },
			})
		).data;
		const accessUrl = this.validateAccessUrl(grant.url);
		const sessionExpiresAt = grant.sessionExpiresAt
			? Date.parse(grant.sessionExpiresAt)
			: Number.NaN;
		if (!Number.isFinite(sessionExpiresAt) || sessionExpiresAt <= Date.now()) {
			throw new SnapflowValidationError(
				`Sandbox ${service} response has an invalid Edge session expiration`
			);
		}

		const accessHeaders = await this.redeemAccessGrant(
			accessUrl,
			sessionExpiresAt
		);

		const connection: EdgeConnection = {
			baseUrl: accessUrl.origin,
			headers: {
				...accessHeaders,
				...(this.options.sdkVersion
					? { [SDK_VERSION_HEADER]: this.options.sdkVersion }
					: {}),
			},
		};
		await this.options.waitUntilReady?.(connection, sessionExpiresAt);
		this.connection = connection;
		this.expiresAtMilliseconds = sessionExpiresAt;
		return connection;
	}

	// Every runtime redeems in token mode and presents the session token itself
	// (a header, or a WebSocket subprotocol where headers are impossible), so
	// no runtime depends on a cookie jar.
	private async redeemAccessGrant(
		accessUrl: URL,
		sessionExpiresAt: number
	): Promise<Readonly<Record<string, string>>> {
		const response = await retryEdgeRequest({
			deadline: edgeDeadline(
				EDGE_SESSION_REDEMPTION_TIMEOUT_MILLISECONDS,
				sessionExpiresAt
			),
			timeoutMessage: `Edge did not redeem the ${this.options.service} access grant before the access timeout`,
			send: (timeout) =>
				edgeFetch(
					accessUrl.toString(),
					{ headers: { [EDGE_ACCESS_MODE_HEADER]: EDGE_ACCESS_TOKEN_MODE } },
					timeout
				),
		});
		return {
			[EDGE_ACCESS_TOKEN_HEADER]: await this.readAccessToken(response),
		};
	}

	private async readAccessToken(response: Response): Promise<string> {
		if (!isSuccessfulResponse(response)) {
			await response.body?.cancel();
			throw this.rejectedGrant(response.status);
		}
		const redemption: unknown = await response.json();
		if (!isTokenRedemption(redemption)) {
			throw new SnapflowAuthenticationError(
				`Edge did not establish a ${this.options.service} access session`
			);
		}
		return redemption.token;
	}

	private rejectedGrant(status: number): SnapflowError {
		return new SnapflowError(
			`Edge rejected the ${this.options.service} access grant with HTTP ${status}`,
			status
		);
	}

	private validateAccessUrl(value: string): URL {
		let accessUrl: URL;
		try {
			accessUrl = new URL(value);
		} catch {
			throw new SnapflowValidationError(
				`Sandbox ${this.options.service} response has an invalid Edge URL`
			);
		}
		if (accessUrl.protocol !== SECURE_PROTOCOL) {
			throw new SnapflowValidationError(
				`Sandbox ${this.options.service} Edge URL must use HTTPS`
			);
		}
		return accessUrl;
	}
}

interface EdgeRetryOptions {
	deadline: number;
	timeoutMessage: string;
	send: (timeoutMilliseconds: number) => Promise<Response>;
	signal?: AbortSignal;
}

export async function edgeFetch(
	url: string,
	init: RequestInit,
	timeoutMilliseconds: number
): Promise<Response> {
	const timeoutSignal = AbortSignal.timeout(timeoutMilliseconds);
	try {
		return await fetch(url, {
			...init,
			signal: init.signal
				? AbortSignal.any([init.signal, timeoutSignal])
				: timeoutSignal,
		});
	} catch (error) {
		throw createRequestSnapflowError(error);
	}
}

export async function retryEdgeRequest(
	options: EdgeRetryOptions
): Promise<Response> {
	while (Date.now() < options.deadline) {
		options.signal?.throwIfAborted();
		const response = await options.send(
			Math.max(
				options.deadline - Date.now(),
				MINIMUM_REQUEST_TIMEOUT_MILLISECONDS
			)
		);
		if (!isRetryableEdgeResponse(response)) return response;
		await response.body?.cancel();
		await abortableDelay(
			Math.min(
				retryAfterMilliseconds(response.headers.get(RETRY_AFTER_HEADER)),
				Math.max(options.deadline - Date.now(), 0)
			),
			options.signal
		);
	}
	throw new SnapflowTimeoutError(options.timeoutMessage);
}

export function edgeDeadline(
	timeoutMilliseconds: number,
	sessionExpiresAt: number
): number {
	return Math.min(
		Date.now() + timeoutMilliseconds,
		sessionExpiresAt - EDGE_SESSION_REFRESH_SKEW_MILLISECONDS
	);
}

export function isSuccessfulResponse(response: Response): boolean {
	return (
		response.status >= HTTP_SUCCESS_LOWER_BOUND &&
		response.status < HTTP_SUCCESS_UPPER_BOUND
	);
}

function isRetryableEdgeResponse(
	response: Pick<Response, 'headers' | 'status'>
): boolean {
	const edgeError = response.headers.get(EDGE_ERROR_HEADER);
	return (
		(response.status === HTTP_SERVICE_UNAVAILABLE_STATUS &&
			(edgeError === EDGE_NO_READY_BACKEND_ERROR ||
				edgeError === EDGE_TARGET_UNAVAILABLE_ERROR)) ||
		(response.status === HTTP_BAD_GATEWAY_STATUS &&
			edgeError === EDGE_UPSTREAM_UNAVAILABLE_ERROR)
	);
}

function retryAfterMilliseconds(value: string | null): number {
	if (value !== null) {
		const seconds = Number(value);
		if (Number.isFinite(seconds) && seconds >= 0) {
			return Math.min(
				seconds * MILLISECONDS_PER_SECOND,
				EDGE_RETRY_MAXIMUM_MILLISECONDS
			);
		}
		const date = Date.parse(value);
		if (Number.isFinite(date)) {
			return Math.min(
				Math.max(date - Date.now(), 0),
				EDGE_RETRY_MAXIMUM_MILLISECONDS
			);
		}
	}
	return EDGE_RETRY_FALLBACK_MILLISECONDS;
}

function isTokenRedemption(value: unknown): value is { token: string } {
	return (
		typeof value === 'object' &&
		value !== null &&
		'token' in value &&
		typeof value.token === 'string' &&
		value.token !== ''
	);
}
