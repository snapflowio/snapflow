/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { z } from 'zod';
import { registryHost } from '../../docker-registry/utils/docker-registry-url.util';
import { GUEST_RELEASE } from '../constants/benchmark-policy.constants';
import { sha256 } from './nonce-stream.util';

const SHA256_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;

const digestSchema = z.string().regex(SHA256_DIGEST_PATTERN);

const descriptorSchema = z.object({
	mediaType: z.string(),
	digest: digestSchema,
	artifactType: z.string().optional(),
	annotations: z.record(z.string(), z.string()).optional(),
	platform: z
		.object({
			os: z.string(),
			architecture: z.string(),
		})
		.optional(),
});

const indexSchema = z.object({
	mediaType: z.literal(GUEST_RELEASE.INDEX_MEDIA_TYPE),
	artifactType: z.string().optional(),
	manifests: z.array(descriptorSchema),
});

export type OciIndex = z.infer<typeof indexSchema>;

export function isSha256Digest(value: string): boolean {
	return SHA256_DIGEST_PATTERN.test(value);
}

export function contentMatchesDigest(
	content: Uint8Array,
	digest: string
): boolean {
	return (
		isSha256Digest(digest) &&
		`${GUEST_RELEASE.DIGEST_PREFIX}${sha256(content).toString('hex')}` ===
			digest
	);
}

export function parseOciIndex(content: Uint8Array): OciIndex | null {
	try {
		const parsed = indexSchema.safeParse(
			JSON.parse(Buffer.from(content).toString('utf8'))
		);
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

export function benchmarkIndexDigest(release: OciIndex): string | null {
	const benchmarks = release.manifests.filter(
		(descriptor) =>
			descriptor.annotations?.[GUEST_RELEASE.ARTIFACT_ANNOTATION] ===
			GUEST_RELEASE.BENCHMARK_ARTIFACT
	);
	const [benchmark] = benchmarks;
	if (
		benchmarks.length !== 1 ||
		!benchmark ||
		benchmark.mediaType !== GUEST_RELEASE.INDEX_MEDIA_TYPE ||
		benchmark.artifactType !== GUEST_RELEASE.BENCHMARK_ARTIFACT_TYPE
	) {
		return null;
	}
	return benchmark.digest;
}

export function benchmarkPlatformDigest(
	benchmarkIndex: OciIndex,
	platform: string
): string | null {
	if (benchmarkIndex.artifactType !== GUEST_RELEASE.BENCHMARK_ARTIFACT_TYPE) {
		return null;
	}
	const images = benchmarkIndex.manifests.filter(
		(descriptor) =>
			descriptor.mediaType === GUEST_RELEASE.IMAGE_MEDIA_TYPE &&
			descriptor.platform !== undefined &&
			`${descriptor.platform.os}${GUEST_RELEASE.PLATFORM_SEPARATOR}${descriptor.platform.architecture}` ===
				platform
	);
	const [image] = images;
	return images.length === 1 && image ? image.digest : null;
}

export function benchmarkImageReference(
	registryUrl: string,
	digest: string
): string {
	return `${registryHost(registryUrl)}/${GUEST_RELEASE.REPOSITORY}${GUEST_RELEASE.REFERENCE_DIGEST_SEPARATOR}${digest}`;
}

const BEARER_SCHEME_PATTERN = /^Bearer\s+/i;
const CHALLENGE_PARAMETER_PATTERN = /([a-z]+)="([^"]*)"/gi;
const CHALLENGE_NAME_GROUP = 1;
const CHALLENGE_VALUE_GROUP = 2;
const REALM_PARAMETER = 'realm';

export interface BearerChallenge {
	realm: string;
	parameters: ReadonlyMap<string, string>;
}

export function parseBearerChallenge(
	header: string | null
): BearerChallenge | null {
	if (!header || !BEARER_SCHEME_PATTERN.test(header)) {
		return null;
	}
	const parameters = new Map<string, string>();
	for (const parameter of header.matchAll(CHALLENGE_PARAMETER_PATTERN)) {
		const name = parameter[CHALLENGE_NAME_GROUP];
		const value = parameter[CHALLENGE_VALUE_GROUP];
		if (name && value !== undefined) {
			parameters.set(name.toLowerCase(), value);
		}
	}
	const realm = parameters.get(REALM_PARAMETER);
	if (!realm) {
		return null;
	}
	parameters.delete(REALM_PARAMETER);
	return { realm, parameters };
}

export function bearerTokenUrl(challenge: BearerChallenge): string {
	const url = new URL(challenge.realm);
	for (const [name, value] of challenge.parameters) {
		url.searchParams.set(name, value);
	}
	return url.toString();
}
