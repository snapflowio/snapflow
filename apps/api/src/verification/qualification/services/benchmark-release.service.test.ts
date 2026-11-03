/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, afterEach, before, describe, it, mock } from 'node:test';
import { type INestApplicationContext, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SettingsService } from '../../../settings/platform/services/settings.service';
import { GUEST_RELEASE } from '../constants/benchmark-policy.constants';
import { parseBearerChallenge } from '../utils/benchmark-image.util';
import { BenchmarkReleaseService } from './benchmark-release.service';

const REGISTRY_URL = 'https://ghcr.io';
const REGISTRY_HOST = 'ghcr.io';
const PLATFORM = 'linux/amd64';
const AMD64_IMAGE = `sha256:${'a'.repeat(64)}`;
const ARM64_IMAGE = `sha256:${'b'.repeat(64)}`;
const TOKEN_REALM = 'https://ghcr.io/token';
const PULL_TOKEN = 'anonymous-pull-token';
const UNAUTHORIZED = 401;
const NOT_FOUND = 404;

function digestOf(content: string): string {
	return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

const benchmarkIndex = JSON.stringify({
	schemaVersion: 2,
	mediaType: GUEST_RELEASE.INDEX_MEDIA_TYPE,
	artifactType: GUEST_RELEASE.BENCHMARK_ARTIFACT_TYPE,
	manifests: [
		{
			mediaType: GUEST_RELEASE.IMAGE_MEDIA_TYPE,
			digest: AMD64_IMAGE,
			size: 1,
			platform: { os: 'linux', architecture: 'amd64' },
		},
		{
			mediaType: GUEST_RELEASE.IMAGE_MEDIA_TYPE,
			digest: ARM64_IMAGE,
			size: 1,
			platform: { os: 'linux', architecture: 'arm64' },
		},
	],
});

const releaseIndex = JSON.stringify({
	schemaVersion: 2,
	mediaType: GUEST_RELEASE.INDEX_MEDIA_TYPE,
	manifests: [
		{
			mediaType: GUEST_RELEASE.INDEX_MEDIA_TYPE,
			artifactType: GUEST_RELEASE.BENCHMARK_ARTIFACT_TYPE,
			digest: digestOf(benchmarkIndex),
			size: benchmarkIndex.length,
			annotations: {
				[GUEST_RELEASE.ARTIFACT_ANNOTATION]: GUEST_RELEASE.BENCHMARK_ARTIFACT,
			},
		},
	],
});

const RELEASE_DIGEST = digestOf(releaseIndex);

function manifestUrl(digest: string): string {
	return `${REGISTRY_URL}/v2/${GUEST_RELEASE.REPOSITORY}/manifests/${digest}`;
}

function registry(
	content: ReadonlyMap<string, string>
): (input: string | URL | Request, init?: RequestInit) => Promise<Response> {
	return async (input, init) => {
		const url = String(input);
		if (url.startsWith(TOKEN_REALM)) {
			return Response.json({ token: PULL_TOKEN });
		}
		const headers = new Headers(init?.headers);
		if (headers.get('Authorization') !== `Bearer ${PULL_TOKEN}`) {
			return new Response(null, {
				status: UNAUTHORIZED,
				headers: {
					'WWW-Authenticate': `Bearer realm="${TOKEN_REALM}",service="${REGISTRY_HOST}",scope="repository:${GUEST_RELEASE.REPOSITORY}:pull"`,
				},
			});
		}
		const body = content.get(url);
		return body === undefined
			? new Response(null, { status: NOT_FOUND })
			: new Response(body);
	};
}

class GuestRegistrySettings {
	async get(): Promise<{ machineGuestRegistryUrl: string }> {
		return { machineGuestRegistryUrl: REGISTRY_URL };
	}
}

@Module({
	providers: [
		BenchmarkReleaseService,
		{ provide: SettingsService, useValue: new GuestRegistrySettings() },
	],
})
class BenchmarkReleaseTestModule {}

let application: INestApplicationContext;

before(async () => {
	application = await NestFactory.createApplicationContext(
		BenchmarkReleaseTestModule,
		{ logger: false }
	);
});

after(() => application.close());

function service(): BenchmarkReleaseService {
	return application.get(BenchmarkReleaseService);
}

function capabilities(guestReleaseDigest: string) {
	return { guestReleaseDigest, guestPlatforms: [PLATFORM] };
}

const publishedRegistry = new Map([
	[manifestUrl(RELEASE_DIGEST), releaseIndex],
	[manifestUrl(digestOf(benchmarkIndex)), benchmarkIndex],
]);

describe('BenchmarkReleaseService', () => {
	afterEach(() => mock.restoreAll());

	it('resolves the platform benchmark image of the machine release', async () => {
		mock.method(globalThis, 'fetch', registry(publishedRegistry));
		assert.equal(
			await service().trustedBenchmarkImage(capabilities(RELEASE_DIGEST)),
			`${REGISTRY_HOST}/${GUEST_RELEASE.REPOSITORY}@${AMD64_IMAGE}`
		);
	});

	it('trusts no image for a release the registry never published', async () => {
		mock.method(globalThis, 'fetch', registry(publishedRegistry));
		assert.equal(
			await service().trustedBenchmarkImage(
				capabilities(`sha256:${'c'.repeat(64)}`)
			),
			null
		);
	});

	it('trusts no image when the registry content does not match the digest', async () => {
		const tampered = new Map(publishedRegistry);
		tampered.set(
			manifestUrl(RELEASE_DIGEST),
			releaseIndex.replace(GUEST_RELEASE.BENCHMARK_ARTIFACT, 'other')
		);
		mock.method(globalThis, 'fetch', registry(tampered));
		assert.equal(
			await service().trustedBenchmarkImage(capabilities(RELEASE_DIGEST)),
			null
		);
	});

	it('trusts no image without a reported release', async () => {
		assert.equal(await service().trustedBenchmarkImage(null), null);
	});
});

describe('parseBearerChallenge', () => {
	it('reads the token realm and its parameters', () => {
		const challenge = parseBearerChallenge(
			`Bearer realm="${TOKEN_REALM}",service="${REGISTRY_HOST}"`
		);
		assert.equal(challenge?.realm, TOKEN_REALM);
		assert.equal(challenge?.parameters.get('service'), REGISTRY_HOST);
		assert.equal(parseBearerChallenge('Basic realm="registry"'), null);
	});
});
