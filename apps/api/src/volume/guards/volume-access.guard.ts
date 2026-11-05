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
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { VolumeService } from '../services/volume.service';

@Injectable()
export class VolumeAccessGuard extends ResourceAccessGuard {
	constructor(private readonly volumeService: VolumeService) {
		super();
	}

	protected organizationIdOf(
		request: ResourceRequest,
		authContext: OrganizationAuthContext
	): Promise<string> {
		const { volumeId, name } = request.params;
		return this.volumeService.getOrganizationId(
			volumeId
				? { id: volumeId }
				: { name, organizationId: authContext.organizationId }
		);
	}

	protected notFoundMessage(request: ResourceRequest): string {
		const { volumeId, name } = request.params;
		return volumeId
			? `Volume with ID ${volumeId} not found`
			: `Volume with name ${name} not found`;
	}
}
