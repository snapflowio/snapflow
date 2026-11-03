/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { BadRequestException, Injectable } from '@nestjs/common';
import { DOCKER_REGISTRY_PERSISTENCE } from '../constants/docker-registry-persistence.constants';
import type { CreateDockerRegistryInternalDto } from '../dto/create-docker-registry-internal.dto';
import { DockerRegistry } from '../entities/docker-registry.entity';
import { normalizeRegistryUrl } from '../utils/docker-registry-url.util';

@Injectable()
export class DockerRegistryPersistenceService {
	constructor(private readonly entityManager: EntityManager) {}

	async create(
		createDto: CreateDockerRegistryInternalDto,
		organizationId?: string,
		manager?: EntityManager
	): Promise<DockerRegistry> {
		if (manager) {
			return this.createAndFlush(manager, createDto, organizationId);
		}

		return this.entityManager.transactional(
			(transactionManager) =>
				this.createAndFlush(transactionManager, createDto, organizationId),
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	private async createAndFlush(
		manager: EntityManager,
		createDto: CreateDockerRegistryInternalDto,
		organizationId: string | undefined
	): Promise<DockerRegistry> {
		if (organizationId) {
			await this.assertOrganizationCapacity(manager, organizationId);
		}

		const registry = this.createEntity(createDto, organizationId);
		manager.persist(registry);
		await manager.flush();
		return registry;
	}

	private createEntity(
		createDto: CreateDockerRegistryInternalDto,
		organizationId: string | undefined
	): DockerRegistry {
		const registry = new DockerRegistry();
		registry.name = createDto.name;
		registry.url = normalizeRegistryUrl(createDto.url);
		registry.username = createDto.username;
		registry.password = createDto.password;
		registry.project = createDto.project ?? '';
		registry.organizationId = organizationId ?? null;
		registry.registryType = createDto.registryType;
		return registry;
	}

	private async assertOrganizationCapacity(
		manager: EntityManager,
		organizationId: string
	): Promise<void> {
		await manager.execute(
			'SELECT pg_advisory_xact_lock(hashtextextended(?, ?))',
			[organizationId, DOCKER_REGISTRY_PERSISTENCE.CREATION_LOCK_NAMESPACE]
		);
		const registryCount = await manager.count(DockerRegistry, {
			organizationId,
		});

		if (
			registryCount >=
			DOCKER_REGISTRY_PERSISTENCE.MAXIMUM_ORGANIZATION_REGISTRIES
		) {
			throw new BadRequestException(
				'The organization has reached the maximum number of registries'
			);
		}
	}
}
