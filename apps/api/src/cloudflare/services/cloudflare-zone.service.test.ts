/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import { fakeInstance } from '../../common/testing/instance.fake';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { CloudflareZoneService } from './cloudflare-zone.service';

const PLATFORM_DOMAIN = 'sandbox.example.com';
const ZONE = { id: 'zone-1', name: 'example.com' };
const FALLBACK_ORIGIN_PATH = `/zones/${ZONE.id}/custom_hostnames/fallback_origin`;
const HTTP_OK = 200;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;

interface MockResponse {
	status: number;
	result: unknown;
}

type Route = (url: URL) => MockResponse | undefined;

function envelope({ status, result }: MockResponse): Response {
	const success = status === HTTP_OK;
	return new Response(
		JSON.stringify({
			success,
			errors: success ? [] : [{ code: status, message: 'denied' }],
			messages: [],
			result,
			...(Array.isArray(result)
				? {
						result_info: {
							page: 1,
							per_page: result.length,
							count: result.length,
							total_count: result.length,
							total_pages: 1,
						},
					}
				: {}),
		}),
		{ status, headers: { 'content-type': 'application/json' } }
	);
}

function mockCloudflare(route: Route): URL[] {
	const requests: URL[] = [];
	mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
		const url = new URL(input instanceof Request ? input.url : input);
		requests.push(url);
		const response = route(url);
		if (!response) throw new Error(`unexpected request ${url.href}`);
		return envelope(response);
	});
	return requests;
}

const zones =
	(byName: Record<string, unknown[]>, status = HTTP_OK): Route =>
	(url) =>
		url.pathname.endsWith('/zones')
			? { status, result: byName[url.searchParams.get('name') ?? ''] ?? [] }
			: undefined;

const withFallbackOrigin =
	(zoneRoute: Route, fallback: MockResponse): Route =>
	(url) =>
		url.pathname.endsWith(FALLBACK_ORIGIN_PATH) ? fallback : zoneRoute(url);

function service(): CloudflareZoneService {
	const values: Record<string, string> = {
		'cloudflareIngress.apiToken': 'test-token',
		'networking.platformDomain': PLATFORM_DOMAIN,
	};
	return new CloudflareZoneService(
		fakeInstance(TypedConfigService, {
			get: (key: string) => values[key],
		})
	);
}

afterEach(() => mock.restoreAll());

describe('CloudflareZoneService', () => {
	it('finds the zone of a parent domain and caches it', async () => {
		const requests = mockCloudflare(zones({ [ZONE.name]: [ZONE] }));
		const zone = service();

		assert.equal((await zone.connection()).zoneId, ZONE.id);
		assert.equal((await zone.connection()).zoneId, ZONE.id);
		assert.deepEqual(
			requests.map((url) => url.searchParams.get('name')),
			[PLATFORM_DOMAIN, ZONE.name]
		);
	});

	it('targets custom domains at the active fallback origin', async () => {
		mockCloudflare(
			withFallbackOrigin(zones({ [ZONE.name]: [ZONE] }), {
				status: HTTP_OK,
				result: { origin: 'Fallback.Example.com', status: 'active' },
			})
		);

		assert.equal(
			await service().customHostnameTarget(),
			'fallback.example.com'
		);
	});

	it('names Zone:Read when the token cannot list zones', async () => {
		mockCloudflare(zones({}, HTTP_FORBIDDEN));

		await assert.rejects(service().connection(), /grant it Zone:Read/);
	});

	it('names Zone:Read when no zone is visible to the token', async () => {
		mockCloudflare(zones({}));

		await assert.rejects(
			service().connection(),
			/No Cloudflare zone of sandbox\.example\.com .* Zone:Read/
		);
	});

	it('names SSL and Certificates:Read when the fallback origin is unreadable', async () => {
		mockCloudflare(
			withFallbackOrigin(zones({ [ZONE.name]: [ZONE] }), {
				status: HTTP_FORBIDDEN,
				result: null,
			})
		);

		await assert.rejects(
			service().customHostnameTarget(),
			/grant it SSL and Certificates:Read/
		);
	});

	it('refuses a missing or inactive fallback origin', async () => {
		mockCloudflare(
			withFallbackOrigin(zones({ [ZONE.name]: [ZONE] }), {
				status: HTTP_NOT_FOUND,
				result: null,
			})
		);
		await assert.rejects(
			service().customHostnameTarget(),
			/has no custom hostname fallback origin/
		);

		mock.restoreAll();
		mockCloudflare(
			withFallbackOrigin(zones({ [ZONE.name]: [ZONE] }), {
				status: HTTP_OK,
				result: {
					origin: 'fallback.example.com',
					status: 'pending_deployment',
				},
			})
		);
		await assert.rejects(
			service().customHostnameTarget(),
			/is pending_deployment, not active/
		);
	});

	it('is unconfigured without a token', async () => {
		const zone = new CloudflareZoneService(
			fakeInstance(TypedConfigService, { get: () => undefined })
		);

		assert.equal(zone.isConfigured(), false);
		await assert.rejects(zone.connection(), /not configured/);
	});
});
