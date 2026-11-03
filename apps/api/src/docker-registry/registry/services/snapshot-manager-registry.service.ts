/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { DockerRegistry } from '../../persistence/entities/docker-registry.entity';
import { RegistryType } from '../../persistence/enums/registry-type.enum';
import { registryEndpoint } from '../../persistence/utils/docker-registry-url.util';
import {
	SNAPSHOT_MANAGER_REGISTRIES,
	SNAPSHOT_MANAGER_REGISTRY_TYPES,
	type SnapshotManagerRegistryType,
} from '../constants/snapshot-manager-registry.constants';

@Injectable()
export class SnapshotManagerRegistryService {
	private readonly url: string;

	constructor(config: TypedConfigService) {
		this.url = registryEndpoint(config.getOrThrow('snapshotManager').url);
	}

	internal(): DockerRegistry {
		return this.registry(RegistryType.INTERNAL);
	}

	backup(): DockerRegistry {
		return this.registry(RegistryType.BACKUP);
	}

	transient(): DockerRegistry {
		return this.registry(RegistryType.TRANSIENT);
	}

	manages(registry: Pick<DockerRegistry, 'id'>): boolean {
		return this.findById(registry.id) !== null;
	}

	findById(registryId: string): DockerRegistry | null {
		const registryType = SNAPSHOT_MANAGER_REGISTRY_TYPES.find(
			(type) => SNAPSHOT_MANAGER_REGISTRIES[type].id === registryId
		);
		return registryType ? this.registry(registryType) : null;
	}

	get registryUrl(): string {
		return this.url;
	}

	private registry(registryType: SnapshotManagerRegistryType): DockerRegistry {
		const { id, name } = SNAPSHOT_MANAGER_REGISTRIES[registryType];
		const registry = new DockerRegistry();
		registry.id = id;
		registry.name = name;
		registry.url = this.url;
		registry.username = '';
		registry.password = '';
		registry.project = '';
		registry.organizationId = null;
		registry.registryType = registryType;
		return registry;
	}
}
