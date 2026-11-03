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
import { createDesktopLink } from './desktop-link.js';
import { createApiClient } from './snapflow/client-config.js';

const API_URL = 'https://api.snapflow.test';
const SANDBOX_ID = 'sandbox-id';
const EXPOSURE_ID = 'exposure-id';
const IDEMPOTENCY_KEY = 'desktop-link-retry-key';
const IDEMPOTENCY_HEADER = 'Idempotency-Key';
const SESSION_LIFETIME_SECONDS = 900;
const SDK_VERSION = '0.0.0-test';
const EXPOSURES_PATH = `/sandbox/${SANDBOX_ID}/exposures`;
const ACTIVATE_URL = `${API_URL}${EXPOSURES_PATH}/system/${SystemExposureService.Desktop}/activate`;
const GRANT_URL = `${API_URL}${EXPOSURES_PATH}/${EXPOSURE_ID}/access-grants`;
const GRANT = {
	token: 'one-time',
	backendId: 'backend-id',
	expiresAt: '2026-10-04T12:01:00.000Z',
	sessionExpiresAt: '2026-10-04T12:15:00.000Z',
	url: 'https://desktop.edge.example/?SNAPFLOW_ACCESS_GRANT=one-time',
};

function jsonResponse(body: unknown): Response {
	return new Response(JSON.stringify(body), {
		headers: { 'Content-Type': 'application/json' },
	});
}

function stubApi() {
	return vi
		.spyOn(globalThis, 'fetch')
		.mockImplementation(async (input: RequestInfo | URL) => {
			const url = input instanceof Request ? input.url : String(input);
			return url === ACTIVATE_URL
				? jsonResponse({ id: EXPOSURE_ID })
				: jsonResponse(GRANT);
		});
}

function sentRequest(fetchMock: MockInstance, index: number): Request {
	return fetchMock.mock.calls[index][0] as Request;
}

describe('desktop link', () => {
	const client = createApiClient(
		{ apiKey: 'api-key', apiUrl: API_URL },
		SDK_VERSION
	);

	afterEach(() => vi.restoreAllMocks());

	it('activates the desktop exposure and grants access to it', async () => {
		const fetchMock = stubApi();

		const link = await createDesktopLink(
			{ sandboxId: SANDBOX_ID, client },
			{
				idempotencyKey: IDEMPOTENCY_KEY,
				sessionLifetimeSeconds: SESSION_LIFETIME_SECONDS,
			}
		);

		expect(link).toEqual(GRANT);
		const activation = sentRequest(fetchMock, 0);
		expect(activation.url).toBe(ACTIVATE_URL);
		expect(activation.headers.get(IDEMPOTENCY_HEADER)).toBe(IDEMPOTENCY_KEY);
		expect(await activation.json()).toEqual({
			durationSeconds: expect.any(Number),
		});
		const grant = sentRequest(fetchMock, 1);
		expect(grant.url).toBe(GRANT_URL);
		expect(grant.headers.get(IDEMPOTENCY_HEADER)).toBe(IDEMPOTENCY_KEY);
		expect(await grant.json()).toEqual({
			sessionLifetimeSeconds: SESSION_LIFETIME_SECONDS,
		});
	});

	it('uses a fresh idempotency key and the server session default', async () => {
		const fetchMock = stubApi();

		await createDesktopLink({
			sandboxId: SANDBOX_ID,
			client,
		});

		const key = sentRequest(fetchMock, 0).headers.get(IDEMPOTENCY_HEADER);
		expect(typeof key).toBe('string');
		const grant = sentRequest(fetchMock, 1);
		expect(grant.headers.get(IDEMPOTENCY_HEADER)).toBe(key);
		expect(await grant.json()).toEqual({});
	});
});
