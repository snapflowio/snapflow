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
import { RegistryTokenService } from './registry-token.service';

const REGISTRY_REQUEST_TIMEOUT_MILLISECONDS = 3_000;
const MAXIMUM_CLEANUP_TAGS = 500;
const SANDBOX_REPOSITORY_PREFIXES = ['backup-', 'snapshot-'] as const;
const CONTENT_DIGEST_HEADER = 'docker-content-digest';
const DOCKER_MANIFEST_MEDIA_TYPE =
	'application/vnd.docker.distribution.manifest.v2+json';
const MANIFEST_MEDIA_TYPES = [
	'application/vnd.oci.image.index.v1+json',
	'application/vnd.oci.image.manifest.v1+json',
	'application/vnd.docker.distribution.manifest.list.v2+json',
	DOCKER_MANIFEST_MEDIA_TYPE,
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

	async deleteSandboxRepository(
		repository: string,
		registry: DockerRegistry
	): Promise<void> {
		try {
			for (const prefix of SANDBOX_REPOSITORY_PREFIXES) {
				await this.deleteRepositoryWithPrefix(repository, prefix, registry);
			}
		} catch (error) {
			this.logger.error(
				`Failed to delete repositories for ${repository}: ${errorMessage(error)}`
			);
			throw error;
		}
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

		const repositoryUrl = `${registryEndpoint(registry.url)}/v2/${image.path}`;
		const authorization = await this.authorization(registry, image.path);

		const manifestResponse = await sendBodilessRegistryRequest(
			`${repositoryUrl}/manifests/${image.manifestReference ?? LATEST_IMAGE_TAG}`,
			{
				method: 'HEAD',
				headers: {
					Authorization: authorization,
					Accept: MANIFEST_MEDIA_TYPES.join(', '),
				},
			}
		);
		if (manifestResponse.status === HttpStatus.NOT_FOUND) {
			return;
		}
		if (!manifestResponse.ok) {
			throw new Error(
				`Failed to get manifest for image ${imageName}: ${describeStatus(manifestResponse)}`
			);
		}

		const digest = manifestResponse.headers.get(CONTENT_DIGEST_HEADER);
		if (!digest) {
			throw new Error(`Docker content digest not found for image ${imageName}`);
		}

		const deleteResponse = await sendBodilessRegistryRequest(
			`${repositoryUrl}/manifests/${digest}`,
			{ method: 'DELETE', headers: { Authorization: authorization } }
		);
		if (!deleteResponse.ok && deleteResponse.status !== HttpStatus.NOT_FOUND) {
			throw new Error(
				`Failed to remove image ${imageName} from registry: ${describeStatus(deleteResponse)}`
			);
		}
		this.logger.debug(`Image ${imageName} removed from the registry`);
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

	private async deleteRepositoryWithPrefix(
		repository: string,
		prefix: string,
		registry: DockerRegistry
	): Promise<void> {
		const repoPath = `${registry.project}/${prefix}${repository}`;
		const repositoryUrl = `${registryEndpoint(registry.url)}/v2/${repoPath}`;
		const authorization = await this.authorization(registry, repoPath);

		try {
			const tags = await this.listTags(repositoryUrl, repoPath, authorization);
			if (!tags) {
				return;
			}
			if (tags.length === 0) {
				this.logger.debug(`Repository ${repoPath} has no tags to delete`);
				return;
			}
			if (tags.length > MAXIMUM_CLEANUP_TAGS) {
				this.logger.warn(
					`Repository ${repoPath} has more than ${MAXIMUM_CLEANUP_TAGS} tags, skipping cleanup`
				);
				return;
			}

			for (const tag of tags) {
				await this.deleteTag(repositoryUrl, repoPath, tag, authorization);
			}

			this.logger.debug(`Repository ${repoPath} cleanup completed`);
		} catch (error) {
			this.logger.error(
				`Exception when deleting repository ${repoPath}: ${errorMessage(error)}`
			);
			throw error;
		}
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

	private async deleteTag(
		repositoryUrl: string,
		repoPath: string,
		tag: string,
		authorization: string
	): Promise<void> {
		try {
			const manifestResponse = await sendBodilessRegistryRequest(
				`${repositoryUrl}/manifests/${tag}`,
				{
					method: 'HEAD',
					headers: {
						Authorization: authorization,
						Accept: DOCKER_MANIFEST_MEDIA_TYPE,
					},
				}
			);

			if (!manifestResponse.ok) {
				this.logger.warn(
					`Couldn't get manifest for tag ${tag}: ${describeStatus(manifestResponse)}`
				);
				return;
			}

			const digest = manifestResponse.headers.get(CONTENT_DIGEST_HEADER);
			if (!digest) {
				this.logger.warn(`Docker content digest not found for tag ${tag}`);
				return;
			}

			const deleteResponse = await sendBodilessRegistryRequest(
				`${repositoryUrl}/manifests/${digest}`,
				{ method: 'DELETE', headers: { Authorization: authorization } }
			);

			if (deleteResponse.ok) {
				this.logger.debug(`Deleted tag ${tag} from repository ${repoPath}`);
			} else {
				this.logger.warn(
					`Failed to delete tag ${tag}: ${describeStatus(deleteResponse)}`
				);
			}
		} catch (error) {
			this.logger.warn(
				`Exception when deleting tag ${tag}: ${errorMessage(error)}`
			);
		}
	}
}
