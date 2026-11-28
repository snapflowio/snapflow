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
import { DOCKER_HUB_URL } from '../constants/docker-registry-persistence.constants';
import { DockerRegistry } from '../entities/docker-registry.entity';
import { RegistryType } from '../enums/registry-type.enum';
import { findRegistryByUrlMatch } from '../utils/registry-match.util';
import { SnapshotManagerRegistryService } from './snapshot-manager-registry.service';

@Injectable()
export class DockerRegistryLookupService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly snapshotManager: SnapshotManagerRegistryService
	) {}

	getAvailableInternalRegistry(): DockerRegistry {
		return this.snapshotManager.internal();
	}

	getAvailableTransientRegistry(): DockerRegistry {
		return this.snapshotManager.transient();
	}

	getAvailableBackupRegistry(): DockerRegistry {
		return this.snapshotManager.backup();
	}

	async getDefaultDockerHubRegistry(): Promise<DockerRegistry | null> {
		return this.entityManager.findOne(DockerRegistry, {
			organizationId: null,
			registryType: RegistryType.INTERNAL,
			url: DOCKER_HUB_URL,
			project: '',
		});
	}

	async findInternalRegistryBySnapshotRef(
		ref: string
	): Promise<DockerRegistry | null> {
		return findRegistryByUrlMatch(await this.internalRegistries(), ref);
	}

	findPlatformOwnedRegistryBySnapshotRef(ref: string): DockerRegistry | null {
		return findRegistryByUrlMatch([this.snapshotManager.internal()], ref);
	}

	async internalRegistries(): Promise<DockerRegistry[]> {
		return [
			this.snapshotManager.internal(),
			...(await this.platformInternalRegistries()),
		];
	}

	platformInternalRegistries(): Promise<DockerRegistry[]> {
		return this.entityManager.find(DockerRegistry, {
			organizationId: null,
			registryType: RegistryType.INTERNAL,
		});
	}
}
