/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { validate as isUuid } from 'uuid';
import type { CursorPage } from '../../common/dto/cursor-page.dto';
import { findCursorPage } from '../../common/utils/pagination/cursor-page.util';
import { CreateDockerRegistryInternalDto } from '../dto/create-docker-registry-internal.dto';
import { UpdateDockerRegistryDto } from '../dto/update-docker-registry.dto';
import { DockerRegistry } from '../entities/docker-registry.entity';
import { RegistryType } from '../enums/registry-type.enum';
import { DockerRegistryNotFoundException } from '../exceptions/docker-registry-not-found.exception';
import { normalizeRegistryUrl } from '../utils/docker-registry-url.util';
import { EcrCredentialsService } from './access/ecr-credentials.service';
import { RegistryPasswordCipher } from './access/registry-password-cipher.service';
import { DockerRegistryImageCleanupService } from './docker-registry-image-cleanup.service';
import { DockerRegistryLookupService } from './docker-registry-lookup.service';
import { DockerRegistryPersistenceService } from './docker-registry-persistence.service';
import { DockerRegistrySourceService } from './docker-registry-source.service';
import { SnapshotManagerRegistryService } from './snapshot-manager-registry.service';

@Injectable()
export class DockerRegistryService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly persistence: DockerRegistryPersistenceService,
		private readonly lookup: DockerRegistryLookupService,
		private readonly source: DockerRegistrySourceService,
		private readonly imageCleanup: DockerRegistryImageCleanupService,
		private readonly ecrCredentials: EcrCredentialsService,
		private readonly snapshotManager: SnapshotManagerRegistryService,
		private readonly passwords: RegistryPasswordCipher
	) {}

	async create(
		createDto: CreateDockerRegistryInternalDto,
		organizationId?: string,
		entityManager?: EntityManager
	): Promise<DockerRegistry> {
		if (organizationId) {
			await this.ecrCredentials.assertCustomerRole(createDto);
		}
		return this.persistence.create(createDto, organizationId, entityManager);
	}

	async findPage(
		organizationId: string,
		registryType: RegistryType,
		limit: number,
		cursor?: string
	): Promise<CursorPage<DockerRegistry>> {
		return findCursorPage(this.entityManager, DockerRegistry, {
			where: { organizationId, registryType },
			orderBy: { createdAt: 'DESC', id: 'DESC' },
			limit,
			cursor,
		});
	}

	async findPlatformRegistries(): Promise<DockerRegistry[]> {
		return this.entityManager.find(
			DockerRegistry,
			{ organizationId: null },
			{ orderBy: { registryType: 'ASC', createdAt: 'ASC' } }
		);
	}

	async createPlatformRegistry(
		createDto: Omit<CreateDockerRegistryInternalDto, 'registryType'>,
		manager: EntityManager
	): Promise<DockerRegistry> {
		return this.persistence.create(
			{ ...createDto, registryType: RegistryType.INTERNAL },
			undefined,
			manager
		);
	}

	async assertPlatformRegistry(registryId: string): Promise<void> {
		const registry = isUuid(registryId)
			? await this.entityManager.findOne(
					DockerRegistry,
					{ id: registryId, organizationId: null },
					{ fields: ['id'] }
				)
			: null;
		if (!registry) throw this.registryNotFound(registryId);
	}

	async findOne(registryId: string): Promise<DockerRegistry | null> {
		return (
			this.snapshotManager.findById(registryId) ??
			(await this.findStored(registryId))
		);
	}

	async findOneOrFail(registryId: string): Promise<DockerRegistry> {
		const registry = await this.findOne(registryId);
		if (!registry) throw this.registryNotFound(registryId);
		return registry;
	}

	async update(
		registryId: string,
		updateDto: UpdateDockerRegistryDto
	): Promise<DockerRegistry> {
		const registry = await this.requireRegistry(registryId);
		if (registry.organizationId) {
			await this.ecrCredentials.assertCustomerRole(updateDto);
		}

		registry.name = updateDto.name;
		registry.url = normalizeRegistryUrl(updateDto.url);
		registry.username = updateDto.username;
		if (updateDto.password) {
			this.passwords.seal(registry, updateDto.password);
		}
		if (updateDto.project !== undefined) {
			registry.project = updateDto.project;
		}

		await this.entityManager.flush();
		return registry;
	}

	async remove(registryId: string): Promise<void> {
		const registry = await this.requireRegistry(registryId);
		this.entityManager.remove(registry);
		await this.entityManager.flush();
	}

	getAvailableInternalRegistry(): DockerRegistry {
		return this.lookup.getAvailableInternalRegistry();
	}

	getDefaultDockerHubRegistry(): Promise<DockerRegistry | null> {
		return this.lookup.getDefaultDockerHubRegistry();
	}

	getAvailableBackupRegistry(): DockerRegistry {
		return this.lookup.getAvailableBackupRegistry();
	}

	findInternalRegistryBySnapshotRef(
		ref: string
	): Promise<DockerRegistry | null> {
		return this.lookup.findInternalRegistryBySnapshotRef(ref);
	}

	findPlatformOwnedRegistryBySnapshotRef(ref: string): DockerRegistry | null {
		return this.lookup.findPlatformOwnedRegistryBySnapshotRef(ref);
	}

	internalRegistries(): Promise<DockerRegistry[]> {
		return this.lookup.internalRegistries();
	}

	findSourceRegistryBySnapshotImageName(
		imageName: string,
		organizationId?: string
	): Promise<DockerRegistry | null> {
		return this.source.findSourceRegistryBySnapshotImageName(
			imageName,
			organizationId
		);
	}

	assertSnapshotSourceAllowed(
		imageName: string,
		organizationId: string
	): Promise<void> {
		return this.source.assertSnapshotSourceAllowed(imageName, organizationId);
	}

	findPushedImageRegistry(
		imageName: string,
		organizationId: string
	): DockerRegistry | null {
		return this.source.findPushedImageRegistry(imageName, organizationId);
	}

	findRegistryByImageName(
		imageName: string,
		organizationId?: string
	): Promise<DockerRegistry | null> {
		return this.source.findRegistryByImageName(imageName, organizationId);
	}

	getBuildCacheRegistry(organizationId: string): DockerRegistry {
		return this.source.getBuildCacheRegistry(organizationId);
	}

	getSourceRegistriesForDockerfile(
		dockerfileContent: string,
		organizationId: string
	): Promise<DockerRegistry[]> {
		return this.source.getSourceRegistriesForDockerfile(
			dockerfileContent,
			organizationId
		);
	}

	deleteRepository(
		repository: string,
		registry: DockerRegistry
	): Promise<void> {
		return this.imageCleanup.deleteRepository(repository, registry);
	}

	deleteTagsExcept(
		repository: string,
		registry: DockerRegistry,
		keptTags: readonly string[]
	): Promise<number> {
		return this.imageCleanup.deleteTagsExcept(repository, registry, keptTags);
	}

	deleteImageFromRegistry(
		imageName: string,
		registry: DockerRegistry
	): Promise<void> {
		return this.imageCleanup.deleteImageFromRegistry(imageName, registry);
	}

	private async requireRegistry(registryId: string): Promise<DockerRegistry> {
		const registry = await this.findStored(registryId);
		if (!registry) {
			throw this.registryNotFound(registryId);
		}
		return registry;
	}

	private async findStored(registryId: string): Promise<DockerRegistry | null> {
		return isUuid(registryId)
			? this.entityManager.findOne(DockerRegistry, { id: registryId })
			: null;
	}

	private registryNotFound(
		registryId: string
	): DockerRegistryNotFoundException {
		return new DockerRegistryNotFoundException(registryId);
	}
}
