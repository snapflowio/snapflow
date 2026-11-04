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

import { SystemExposureService } from '@snapflow/api-client';
import type { MockInstance } from 'vitest';
import {
	emitLogLines,
	readPresignedBuildLog,
	readSandboxBuildLog,
} from './build-logs.js';
import { createApiClient } from './snapflow/client-config.js';
import { EDGE_ACCESS_TOKEN_HEADER } from './utils/edge-access.js';

const API_URL = 'https://api.snapflow.test';
const SANDBOX_ID = 'sandbox-id';
const EXPOSURE_ID = 'exposure-id';
const EDGE_ORIGIN = 'https://build-logs.edge.example';
const ACCESS_URL = `${EDGE_ORIGIN}/.snapflow/access?grant=one-time`;
const ACCESS_TOKEN = 'signed-session-token';
const SESSION_LIFETIME_MILLISECONDS = 60 * 60 * 1_000;
const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const HTTP_FORBIDDEN = 403;
const HTTP_BAD_GATEWAY = 502;
const BUILD_LOG = '#1 FROM python:3.12-slim\r\n#2 RUN echo built\n\n';
const SDK_VERSION = '0.0.0-test';
const EXPOSURES_URL = `${API_URL}/sandbox/${SANDBOX_ID}/exposures`;
const ACTIVATE_URL = `${EXPOSURES_URL}/system/${SystemExposureService.BuildLogs}/activate`;
const GRANT_URL = `${EXPOSURES_URL}/${EXPOSURE_ID}/access-grants`;

function requestUrl(input: RequestInfo | URL): string {
	return input instanceof Request ? input.url : String(input);
}

function jsonResponse(body: unknown): Response {
	return new Response(JSON.stringify(body), {
		headers: { 'Content-Type': 'application/json' },
	});
}

function stubFetch(edgeResponses: Response[]) {
	return vi
		.spyOn(globalThis, 'fetch')
		.mockImplementation(async (input: RequestInfo | URL) => {
			const url = requestUrl(input);
			if (url === ACTIVATE_URL) {
				return jsonResponse({ id: EXPOSURE_ID });
			}
			if (url === GRANT_URL) {
				return jsonResponse({
					url: ACCESS_URL,
					sessionExpiresAt: new Date(
						Date.now() + SESSION_LIFETIME_MILLISECONDS
					).toISOString(),
				});
			}
			const response = edgeResponses.shift();
			if (!response) {
				throw new Error(`Unexpected request to ${url}`);
			}
			return response;
		});
}

function edgeRequests(fetchMock: MockInstance) {
	return fetchMock.mock.calls.filter(
		([input]) => new URL(requestUrl(input)).origin !== new URL(API_URL).origin
	);
}

function buildLogRequest() {
	return {
		sandboxId: SANDBOX_ID,
		client: createApiClient(
			{ apiKey: 'api-key', apiUrl: API_URL },
			SDK_VERSION
		),
	};
}

describe('build logs', () => {
	afterEach(() => vi.restoreAllMocks());

	it('emits non-empty log lines without trailing blank output', () => {
		const lines: string[] = [];
		emitLogLines(BUILD_LOG, (line) => lines.push(line));
		emitLogLines('\n', (line) => lines.push(line));
		expect(lines).toEqual(['#1 FROM python:3.12-slim', '#2 RUN echo built']);
	});

	it('reads sandbox build logs through a redeemed Edge build-log session', async () => {
		const fetchMock = stubFetch([
			jsonResponse({ token: ACCESS_TOKEN }),
			new Response(null, {
				status: HTTP_BAD_GATEWAY,
				headers: {
					'x-snapflow-edge-error': 'upstream_unavailable',
					'retry-after': '0',
				},
			}),
			new Response(BUILD_LOG, { status: HTTP_OK }),
		]);
		const lines: string[] = [];

		await readSandboxBuildLog(buildLogRequest(), (line) => lines.push(line));

		const edgeCalls = edgeRequests(fetchMock);
		expect(requestUrl(edgeCalls[0][0])).toBe(ACCESS_URL);
		expect(edgeCalls[0][1]).toEqual(
			expect.objectContaining({
				headers: { 'X-Snapflow-Access-Mode': 'token' },
			})
		);
		const lastCall = edgeCalls[edgeCalls.length - 1];
		expect(requestUrl(lastCall[0])).toBe(`${EDGE_ORIGIN}/`);
		expect(lastCall[1]).toEqual(
			expect.objectContaining({
				headers: expect.objectContaining({
					[EDGE_ACCESS_TOKEN_HEADER]: ACCESS_TOKEN,
				}),
			})
		);
		expect(lines).toEqual(['#1 FROM python:3.12-slim', '#2 RUN echo built']);
	});

	it('rejects Edge build-log responses instead of emitting them as logs', async () => {
		stubFetch([
			jsonResponse({ token: ACCESS_TOKEN }),
			new Response('protected access is required', {
				status: HTTP_FORBIDDEN,
			}),
		]);
		const onLine = vi.fn();

		await expect(
			readSandboxBuildLog(buildLogRequest(), onLine)
		).rejects.toThrow(`HTTP ${HTTP_FORBIDDEN}`);
		expect(onLine).not.toHaveBeenCalled();
	});

	it('reads presigned snapshot build logs without control-plane credentials', async () => {
		const presignedUrl =
			'http://rustfs:9000/snapflow/org/build-logs/digest.log?X-Amz-Signature=value';
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(new Response(BUILD_LOG, { status: HTTP_OK }))
			.mockResolvedValueOnce(
				new Response('NoSuchKey', { status: HTTP_NOT_FOUND })
			);
		const lines: string[] = [];

		await readPresignedBuildLog(presignedUrl, (line) => lines.push(line));
		await readPresignedBuildLog(presignedUrl, (line) => lines.push(line));

		expect(fetchMock).toHaveBeenCalledWith(presignedUrl);
		expect(lines).toEqual(['#1 FROM python:3.12-slim', '#2 RUN echo built']);
	});
});
