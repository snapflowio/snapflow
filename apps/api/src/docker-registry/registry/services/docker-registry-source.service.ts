/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { InjectRepository } from '@mikro-orm/nestjs';
import type { EntityRepository } from '@mikro-orm/postgresql';
import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { checkDockerfileHasRegistryPrefix } from '../../../common/utils/docker-image.util';
import { errorMessage } from '../../../common/utils/error/error.util';
import { ImageReference } from '../../../common/values/image-reference.value';
import { DOCKER_HUB_URL } from '../../persistence/constants/docker-registry-persistence.constants';
import { DockerRegistry } from '../../persistence/entities/docker-registry.entity';
import { RegistryType } from '../../persistence/enums/registry-type.enum';
import { PLATFORM_REGISTRY_IMAGE_FORBIDDEN } from '../constants/platform-registry-image.constants';
import { isForeignPlatformRegistryImage } from '../utils/platform-registry-image.util';
import {
	findRegistryByUrlMatch,
	isDockerHubRegistry,
	temporaryRegistryConfig,
} from '../utils/registry-match.util';
import {
	isRegistryPushImage,
	registryBuildCacheNamespace,
	registryPushNamespace,
} from '../utils/registry-token-scope.util';
import { DockerRegistryLookupService } from './docker-registry-lookup.service';
import { EcrCredentialsService } from './ecr-credentials.service';
import { SnapshotManagerRegistryService } from './snapshot-manager-registry.service';

@Injectable()
export class DockerRegistrySourceService {
	private readonly logger = new Logger(DockerRegistrySourceService.name);

	constructor(
		@InjectRepository(DockerRegistry)
		private readonly dockerRegistryRepository: EntityRepository<DockerRegistry>,
		private readonly lookup: DockerRegistryLookupService,
		private readonly snapshotManager: SnapshotManagerRegistryService,
		private readonly ecrCredentials: EcrCredentialsService
	) {}

	async findSourceRegistryBySnapshotImageName(
		imageName: string,
		organizationId?: string
	): Promise<DockerRegistry | null> {
		const organizationRegistries = organizationId
			? await this.organizationRegistries(organizationId)
			: [];
		const matched = findRegistryByUrlMatch(
			[...organizationRegistries, ...(await this.lookup.internalRegistries())],
			imageName
		);
		return matched
			? this.ecrCredentials.resolveRegistryCredentials(matched)
			: null;
	}

	async assertSnapshotSourceAllowed(
		imageName: string,
		organizationId: string
	): Promise<void> {
		const registries = await this.dockerRegistryRepository.find(
			{ registryType: { $ne: RegistryType.ORGANIZATION } },
			{ fields: ['url'] }
		);
		const platformRegistryUrls = [
			this.snapshotManager.registryUrl,
			...registries.map((registry) => registry.url),
		];
		if (
			isForeignPlatformRegistryImage(
				imageName,
				platformRegistryUrls,
				organizationId
			)
		) {
			throw new ForbiddenException({
				code: PLATFORM_REGISTRY_IMAGE_FORBIDDEN,
				message:
					'Snapshots can only use platform registry images pushed to your organization namespace',
			});
		}
	}

	findPushedImageRegistry(
		imageName: string,
		organizationId: string
	): DockerRegistry | null {
		const registry = this.lookup.getAvailableTransientRegistry();
		return isRegistryPushImage(imageName, registry.url, organizationId)
			? registry
			: null;
	}

	async findRegistryByImageName(
		imageName: string,
		organizationId?: string
	): Promise<DockerRegistry | null> {
		const image = ImageReference.parse(imageName);

		if (!image.isDockerHub) {
			const registry = await this.findSourceRegistryBySnapshotImageName(
				imageName,
				organizationId
			);
			return registry ?? temporaryRegistryConfig(image.domain);
		}

		if (organizationId) {
			const dockerHubRegistry = (
				await this.organizationRegistries(organizationId)
			).find(isDockerHubRegistry);
			if (dockerHubRegistry) {
				return dockerHubRegistry;
			}
		}
		return temporaryRegistryConfig(DOCKER_HUB_URL);
	}

	async getSourceRegistriesForDockerfile(
		dockerfileContent: string,
		organizationId: string
	): Promise<DockerRegistry[]> {
		const sourceRegistries = checkDockerfileHasRegistryPrefix(dockerfileContent)
			? await this.organizationSourceRegistries(organizationId)
			: [];

		const organizationHasDockerHubCreds = sourceRegistries.some((registry) =>
			registry.url.includes(DOCKER_HUB_URL)
		);
		if (!organizationHasDockerHubCreds) {
			const defaultDockerHubRegistry =
				await this.lookup.getDefaultDockerHubRegistry();
			if (defaultDockerHubRegistry) {
				sourceRegistries.push(defaultDockerHubRegistry);
			}
		}

		return sourceRegistries;
	}

	private async organizationSourceRegistries(
		organizationId: string
	): Promise<DockerRegistry[]> {
		const sourceRegistries: DockerRegistry[] = [
			this.organizationPushSourceRegistry(organizationId),
		];
		const organizationRegistries =
			await this.organizationRegistries(organizationId);
		const settled = await Promise.allSettled(
			organizationRegistries.map((registry) =>
				this.ecrCredentials.resolveRegistryCredentials(registry)
			)
		);
		settled.forEach((result, index) => {
			if (result.status === 'fulfilled') {
				sourceRegistries.push(result.value);
				return;
			}
			const registry = organizationRegistries[index];
			this.logger.warn(
				`Skipping registry ${registry.url} (id=${registry.id}) for Dockerfile build: failed to resolve credentials: ${errorMessage(result.reason)}`
			);
		});
		return sourceRegistries;
	}

	private async organizationRegistries(
		organizationId: string
	): Promise<DockerRegistry[]> {
		return this.dockerRegistryRepository.find(
			{ organizationId, registryType: RegistryType.ORGANIZATION },
			{ orderBy: { createdAt: 'DESC' } }
		);
	}

	/** The build cache namespace; machine-scoped tokens are added at dispatch. */
	getBuildCacheRegistry(organizationId: string): DockerRegistry {
		return {
			...this.lookup.getAvailableTransientRegistry(),
			project: registryBuildCacheNamespace(organizationId),
		};
	}

	private organizationPushSourceRegistry(
		organizationId: string
	): DockerRegistry {
		return {
			...this.lookup.getAvailableTransientRegistry(),
			project: registryPushNamespace(organizationId),
		};
	}
}
