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
} from '../../../common/guards/resource-access.guard';
import type { OrganizationAuthContext } from '../../../common/types/organization-auth-context.types';
import { SandboxService } from '../services/sandbox/sandbox.service';

@Injectable()
export class SandboxAccessGuard extends ResourceAccessGuard {
	constructor(private readonly sandboxService: SandboxService) {
		super();
	}

	protected organizationIdOf(
		request: ResourceRequest,
		authContext: OrganizationAuthContext
	): Promise<string> {
		return this.sandboxService.getOrganizationId(
			sandboxIdOrNameOf(request),
			authContext.organizationId
		);
	}

	protected notFoundMessage(request: ResourceRequest): string {
		return `Sandbox with ID or name ${sandboxIdOrNameOf(request)} not found`;
	}
}

function sandboxIdOrNameOf(request: ResourceRequest): string {
	return request.params.sandboxIdOrName || request.params.sandboxId;
}
