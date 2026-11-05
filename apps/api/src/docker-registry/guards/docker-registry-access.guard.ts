/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import {
	ResourceAccessGuard,
	type ResourceRequest,
} from '../../common/guards/resource-access.guard';
import { RegistryType } from '../persistence/enums/registry-type.enum';
import { DockerRegistryService } from '../services/docker-registry.service';

@Injectable()
export class DockerRegistryAccessGuard extends ResourceAccessGuard {
	constructor(private readonly dockerRegistryService: DockerRegistryService) {
		super();
	}

	protected async organizationIdOf(
		request: ResourceRequest
	): Promise<string | null> {
		const registry = await this.dockerRegistryService.findOneOrFail(
			request.params.id
		);
		return registry.registryType === RegistryType.ORGANIZATION
			? registry.organizationId
			: null;
	}

	protected notFoundMessage(request: ResourceRequest): string {
		return `Docker registry with ID ${request.params.id} not found`;
	}
}
