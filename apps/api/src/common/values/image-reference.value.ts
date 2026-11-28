/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	DOCKER_HUB_REFERENCE,
	IMAGE_DIGEST_HEX_LENGTHS,
	IMAGE_REFERENCE_LIMITS,
	QUALIFIED_IMAGE_REFERENCE_PATTERN,
} from '../constants/image-reference.constants';

const DOMAIN_SEPARATOR = '/';
const DOMAIN_MARKERS = /[.:]/;
const DIGEST_ALGORITHM_SEPARATOR = ':';
const LOWERCASE_HEX = /^[a-f0-9]+$/;

export class ImageReferenceError extends Error {}

export class ImageReference {
	private constructor(
		readonly domain: string,
		readonly path: string,
		readonly tag: string | undefined,
		readonly digest: string | undefined
	) {}

	static parse(value: string): ImageReference {
		const match = QUALIFIED_IMAGE_REFERENCE_PATTERN.exec(normalize(value));
		const groups = match?.groups;
		if (!groups?.domain || !groups.path) {
			throw new ImageReferenceError(
				`Invalid image reference "${value}". Use [registry[:port]/]repository[:tag][@algorithm:digest] with a lowercase repository`
			);
		}
		const name = `${groups.domain}${DOMAIN_SEPARATOR}${groups.path}`;
		if (name.length > IMAGE_REFERENCE_LIMITS.maximumNameLength) {
			throw new ImageReferenceError(
				`Image repository name must be at most ${IMAGE_REFERENCE_LIMITS.maximumNameLength} characters`
			);
		}
		if (groups.digest) assertSupportedDigest(groups.digest);
		return new ImageReference(
			groups.domain,
			groups.path,
			groups.tag,
			groups.digest
		);
	}

	get name(): string {
		return `${this.domain}${DOMAIN_SEPARATOR}${this.path}`;
	}

	get isDockerHub(): boolean {
		return this.domain === DOCKER_HUB_REFERENCE.domain;
	}

	get manifestReference(): string | undefined {
		return this.digest ?? this.tag;
	}

	toString(): string {
		const tag = this.tag === undefined ? '' : `:${this.tag}`;
		const digest = this.digest === undefined ? '' : `@${this.digest}`;
		return `${this.name}${tag}${digest}`;
	}
}

function normalize(value: string): string {
	const separator = value.indexOf(DOMAIN_SEPARATOR);
	const candidate = separator === -1 ? '' : value.slice(0, separator);
	const explicitDomain =
		separator !== -1 &&
		(DOMAIN_MARKERS.test(candidate) ||
			candidate === DOCKER_HUB_REFERENCE.localhost ||
			candidate.toLowerCase() !== candidate);
	const domain = explicitDomain ? candidate : DOCKER_HUB_REFERENCE.domain;
	const remainder = explicitDomain ? value.slice(separator + 1) : value;
	const canonicalDomain =
		domain === DOCKER_HUB_REFERENCE.indexDomain
			? DOCKER_HUB_REFERENCE.domain
			: domain;
	const officialPrefix =
		canonicalDomain === DOCKER_HUB_REFERENCE.domain &&
		!remainder.includes(DOMAIN_SEPARATOR)
			? DOCKER_HUB_REFERENCE.officialRepositoryPrefix
			: '';
	return `${canonicalDomain}${DOMAIN_SEPARATOR}${officialPrefix}${remainder}`;
}

function assertSupportedDigest(digest: string): void {
	const separator = digest.indexOf(DIGEST_ALGORITHM_SEPARATOR);
	const algorithm = digest.slice(0, separator);
	const encoded = digest.slice(separator + 1);
	const expectedLength = IMAGE_DIGEST_HEX_LENGTHS.get(algorithm);
	if (
		expectedLength === undefined ||
		encoded.length !== expectedLength ||
		!LOWERCASE_HEX.test(encoded)
	) {
		throw new ImageReferenceError(
			`Unsupported image digest "${digest}". Use sha256, sha384 or sha512 with lowercase hex`
		);
	}
}
