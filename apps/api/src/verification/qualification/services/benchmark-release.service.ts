/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { HttpStatus, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { registryEndpoint } from '../../../docker-registry/persistence/utils/docker-registry-url.util';
import type { MachineRuntimeCapabilities } from '../../../sandbox/machine/types/machine-runtime.types';
import { SettingsService } from '../../../settings/platform/services/settings.service';
import { GUEST_RELEASE } from '../constants/benchmark-policy.constants';
import {
	bearerTokenUrl,
	benchmarkImageReference,
	benchmarkIndexDigest,
	benchmarkPlatformDigest,
	contentMatchesDigest,
	isSha256Digest,
	type OciIndex,
	parseBearerChallenge,
	parseOciIndex,
} from '../utils/benchmark-image.util';

type MachineGuestRelease = Pick<
	MachineRuntimeCapabilities,
	'guestReleaseDigest' | 'guestPlatforms'
>;

const AUTHENTICATE_HEADER = 'www-authenticate';
const AUTHORIZATION_HEADER = 'Authorization';
const ACCEPT_HEADER = 'Accept';
const BEARER_PREFIX = 'Bearer ';

const tokenSchema = z
	.object({
		token: z.string().min(1).optional(),
		access_token: z.string().min(1).optional(),
	})
	.transform((value) => value.token ?? value.access_token ?? null);

function requestSignal(): AbortSignal {
	return AbortSignal.timeout(GUEST_RELEASE.REQUEST_TIMEOUT_MILLISECONDS);
}

@Injectable()
export class BenchmarkReleaseService {
	constructor(private readonly settings: SettingsService) {}

	async trustedBenchmarkImage(
		capabilities: MachineGuestRelease | null
	): Promise<string | null> {
		const releaseDigest = capabilities?.guestReleaseDigest;
		const platform = capabilities?.guestPlatforms[0];
		const { machineGuestRegistryUrl: registryUrl } = await this.settings.get();
		if (!registryUrl || !releaseDigest || !platform) {
			return null;
		}
		const release = await this.index(registryUrl, releaseDigest);
		const benchmarkDigest = release ? benchmarkIndexDigest(release) : null;
		const benchmark = benchmarkDigest
			? await this.index(registryUrl, benchmarkDigest)
			: null;
		const imageDigest = benchmark
			? benchmarkPlatformDigest(benchmark, platform)
			: null;
		return imageDigest
			? benchmarkImageReference(registryUrl, imageDigest)
			: null;
	}

	private async index(
		registryUrl: string,
		digest: string
	): Promise<OciIndex | null> {
		if (!isSha256Digest(digest)) {
			return null;
		}
		const response = await this.pull(
			`${registryEndpoint(registryUrl)}/v2/${GUEST_RELEASE.REPOSITORY}/manifests/${digest}`
		);
		if (response.status === HttpStatus.NOT_FOUND) {
			await response.body?.cancel();
			return null;
		}
		if (!response.ok) {
			await response.body?.cancel();
			throw new Error(
				`Guest release registry answered ${response.status} for ${digest}`
			);
		}
		const content = new Uint8Array(await response.arrayBuffer());
		if (
			content.byteLength > GUEST_RELEASE.MAXIMUM_INDEX_BYTES ||
			!contentMatchesDigest(content, digest)
		) {
			return null;
		}
		return parseOciIndex(content);
	}

	private async pull(url: string): Promise<Response> {
		const anonymous = await this.fetchIndex(url, null);
		if (anonymous.status !== HttpStatus.UNAUTHORIZED) {
			return anonymous;
		}
		const challenge = parseBearerChallenge(
			anonymous.headers.get(AUTHENTICATE_HEADER)
		);
		await anonymous.body?.cancel();
		if (!challenge) {
			throw new Error('Guest release registry requires credentials');
		}
		const tokenResponse = await fetch(bearerTokenUrl(challenge), {
			signal: requestSignal(),
		});
		if (!tokenResponse.ok) {
			await tokenResponse.body?.cancel();
			throw new Error(
				`Guest release registry token request answered ${tokenResponse.status}`
			);
		}
		const token = tokenSchema.parse(await tokenResponse.json());
		if (!token) {
			throw new Error('Guest release registry issued no pull token');
		}
		return this.fetchIndex(url, token);
	}

	private fetchIndex(url: string, token: string | null): Promise<Response> {
		const headers: Record<string, string> = {
			[ACCEPT_HEADER]: GUEST_RELEASE.INDEX_MEDIA_TYPE,
		};
		if (token) {
			headers[AUTHORIZATION_HEADER] = `${BEARER_PREFIX}${token}`;
		}
		return fetch(url, { headers, signal: requestSignal() });
	}
}
