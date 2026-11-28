/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { LATEST_IMAGE_TAG } from '../../common/constants/image-reference.constants';
import { errorMessage } from '../../common/utils/error/error.util';
import { ImageReference } from '../../common/values/image-reference.value';
import {
	DELETE_ACTIONS,
	REGISTRY_SERVICE_SUBJECT,
	REGISTRY_TOKEN,
	RegistrySubjectKind,
} from '../constants/registry-token.constants';
import type { DockerRegistry } from '../entities/docker-registry.entity';
import { registryEndpoint } from '../utils/docker-registry-url.util';
import { registrySubject } from '../utils/registry-token-scope.util';
import { RegistryTokenService } from './access/registry-token.service';

const REGISTRY_REQUEST_TIMEOUT_MILLISECONDS = 3_000;
const MAXIMUM_CLEANUP_TAGS = 500;
const CONTENT_DIGEST_HEADER = 'docker-content-digest';
const MANIFEST_MEDIA_TYPES = [
	'application/vnd.oci.image.index.v1+json',
	'application/vnd.oci.image.manifest.v1+json',
	'application/vnd.docker.distribution.manifest.list.v2+json',
	'application/vnd.docker.distribution.manifest.v2+json',
] as const;

const tagListSchema = z.object({
	tags: z.array(z.string()).nullish(),
});

type RegistryRequest = Required<Pick<RequestInit, 'method' | 'headers'>>;

function basicAuthorization(registry: DockerRegistry): string {
	return `Basic ${Buffer.from(
		`${registry.username}:${registry.password}`
	).toString('base64')}`;
}

function describeStatus(response: Response): string {
	return `${response.status} ${response.statusText}`;
}

async function sendRegistryRequest(
	url: string,
	request: RegistryRequest
): Promise<Response> {
	const response = await fetch(url, {
		...request,
		signal: AbortSignal.timeout(REGISTRY_REQUEST_TIMEOUT_MILLISECONDS),
	});
	if (response.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
		await response.body?.cancel();
		throw new Error(
			`Registry request ${request.method} ${url} failed with ${describeStatus(response)}`
		);
	}
	return response;
}

async function sendBodilessRegistryRequest(
	url: string,
	request: RegistryRequest
): Promise<Response> {
	const response = await sendRegistryRequest(url, request);
	await response.body?.cancel();
	return response;
}

@Injectable()
export class DockerRegistryImageCleanupService {
	private readonly logger = new Logger(DockerRegistryImageCleanupService.name);

	constructor(private readonly registryTokens: RegistryTokenService) {}

	async deleteRepository(
		repository: string,
		registry: DockerRegistry
	): Promise<void> {
		const repositoryUrl = `${registryEndpoint(registry.url)}/v2/${repository}`;
		const authorization = await this.authorization(registry, repository);
		try {
			const tags = await this.listTags(
				repositoryUrl,
				repository,
				authorization
			);
			if (!tags) {
				return;
			}
			if (tags.length > MAXIMUM_CLEANUP_TAGS) {
				this.logger.warn(
					`Repository ${repository} has more than ${MAXIMUM_CLEANUP_TAGS} tags, skipping cleanup`
				);
				return;
			}
			for (const tag of tags) {
				await this.deleteManifest(repositoryUrl, tag, authorization);
			}
			this.logger.debug(
				`Repository ${repository} cleanup removed ${tags.length} tags`
			);
		} catch (error) {
			this.logger.error(
				`Failed to delete repository ${repository}: ${errorMessage(error)}`
			);
			throw error;
		}
	}

	async deleteTagsExcept(
		repository: string,
		registry: DockerRegistry,
		keptTags: readonly string[]
	): Promise<number> {
		const repositoryUrl = `${registryEndpoint(registry.url)}/v2/${repository}`;
		const authorization = await this.authorization(registry, repository);
		const tags = await this.listTags(repositoryUrl, repository, authorization);
		if (!tags) return 0;
		const keptDigests = new Set<string>();
		for (const tag of keptTags) {
			const digest = await this.manifestDigest(
				repositoryUrl,
				tag,
				authorization
			);
			if (digest) keptDigests.add(digest);
		}
		const deleted = new Set<string>();
		for (const tag of tags.filter((tag) => !keptTags.includes(tag))) {
			const digest = await this.manifestDigest(
				repositoryUrl,
				tag,
				authorization
			);
			if (!digest || keptDigests.has(digest) || deleted.has(digest)) continue;
			await this.deleteDigest(repositoryUrl, digest, authorization);
			deleted.add(digest);
		}
		return deleted.size;
	}

	async deleteImageFromRegistry(
		imageName: string,
		registry: DockerRegistry
	): Promise<void> {
		const image = ImageReference.parse(imageName);
		if (!image.path.includes('/')) {
			throw new Error(
				'Invalid image name format. Expected: [registry]/project/repository[:tag]'
			);
		}

		await this.deleteManifest(
			`${registryEndpoint(registry.url)}/v2/${image.path}`,
			image.manifestReference ?? LATEST_IMAGE_TAG,
			await this.authorization(registry, image.path)
		);
		this.logger.debug(`Image ${imageName} removed from the registry`);
	}

	private async deleteManifest(
		repositoryUrl: string,
		reference: string,
		authorization: string
	): Promise<void> {
		const digest = await this.manifestDigest(
			repositoryUrl,
			reference,
			authorization
		);
		if (digest) await this.deleteDigest(repositoryUrl, digest, authorization);
	}

	private async manifestDigest(
		repositoryUrl: string,
		reference: string,
		authorization: string
	): Promise<string | null> {
		const manifestResponse = await sendBodilessRegistryRequest(
			`${repositoryUrl}/manifests/${reference}`,
			{
				method: 'HEAD',
				headers: {
					Authorization: authorization,
					Accept: MANIFEST_MEDIA_TYPES.join(', '),
				},
			}
		);
		if (manifestResponse.status === HttpStatus.NOT_FOUND) {
			return null;
		}
		if (!manifestResponse.ok) {
			throw new Error(
				`Failed to get manifest ${repositoryUrl}:${reference}: ${describeStatus(manifestResponse)}`
			);
		}
		const digest = manifestResponse.headers.get(CONTENT_DIGEST_HEADER);
		if (!digest) {
			throw new Error(
				`Registry returned no content digest for ${repositoryUrl}:${reference}`
			);
		}
		return digest;
	}

	private async deleteDigest(
		repositoryUrl: string,
		digest: string,
		authorization: string
	): Promise<void> {
		const deleteResponse = await sendBodilessRegistryRequest(
			`${repositoryUrl}/manifests/${digest}`,
			{ method: 'DELETE', headers: { Authorization: authorization } }
		);
		if (!deleteResponse.ok && deleteResponse.status !== HttpStatus.NOT_FOUND) {
			throw new Error(
				`Failed to delete manifest ${repositoryUrl}@${digest}: ${describeStatus(deleteResponse)}`
			);
		}
	}

	private async authorization(
		registry: DockerRegistry,
		repository: string
	): Promise<string> {
		return basicAuthorization(
			await this.registryTokens.authorize(registry, {
				subject: registrySubject(
					RegistrySubjectKind.SERVICE,
					REGISTRY_SERVICE_SUBJECT
				),
				access: [{ name: repository, actions: DELETE_ACTIONS }],
				ttlSeconds: REGISTRY_TOKEN.SERVICE_TTL_SECONDS,
			})
		);
	}

	private async listTags(
		repositoryUrl: string,
		repoPath: string,
		authorization: string
	): Promise<string[] | null> {
		const tagsResponse = await sendRegistryRequest(
			`${repositoryUrl}/tags/list`,
			{ method: 'GET', headers: { Authorization: authorization } }
		);

		if (tagsResponse.status === HttpStatus.NOT_FOUND) {
			await tagsResponse.body?.cancel();
			return null;
		}

		if (!tagsResponse.ok) {
			await tagsResponse.body?.cancel();
			throw new Error(
				`Failed to list tags in repository ${repoPath}: ${describeStatus(tagsResponse)}`
			);
		}

		return tagListSchema.parse(await tagsResponse.json()).tags ?? [];
	}
}
