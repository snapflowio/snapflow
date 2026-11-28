/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable, Logger } from '@nestjs/common';
import {
	ResourceAccessGuard,
	type ResourceRequest,
} from '../../common/guards/resource-access.guard';
import {
	AUTH_CREDENTIAL_TYPES,
	type OrganizationAuthContext,
} from '../../common/types/organization-auth-context.types';
import { errorMessage } from '../../common/utils/error/error.util';
import { SandboxState } from '../enums/sandbox-state.enum';
import { SandboxNotFoundException } from '../exceptions/sandbox-not-found.exception';
import { SandboxService } from '../services/sandbox/sandbox.service';
import { SandboxActivityService } from '../services/sandbox/sandbox-activity.service';

@Injectable()
export class SandboxAccessGuard extends ResourceAccessGuard {
	private readonly activityLogger = new Logger(SandboxAccessGuard.name);

	constructor(
		private readonly sandboxService: SandboxService,
		private readonly activity: SandboxActivityService
	) {
		super();
	}

	protected async organizationIdOf(
		request: ResourceRequest,
		authContext: OrganizationAuthContext
	): Promise<string> {
		const sandbox = await this.sandboxService.getAccessScope(
			sandboxIdOrNameOf(request),
			authContext.organizationId
		);
		if (
			authContext.credential.type === AUTH_CREDENTIAL_TYPES.API_KEY &&
			sandbox.state === SandboxState.STARTED
		) {
			await this.recordSdkCall(sandbox.id);
		}
		return sandbox.organizationId;
	}

	protected notFound(request: ResourceRequest): SandboxNotFoundException {
		return new SandboxNotFoundException(sandboxIdOrNameOf(request));
	}

	private async recordSdkCall(sandboxId: string): Promise<void> {
		try {
			await this.activity.updateLastActivityAt(sandboxId, new Date());
		} catch (error) {
			this.activityLogger.warn(
				`Failed to record SDK activity of sandbox ${sandboxId}: ${errorMessage(error)}`
			);
		}
	}
}

function sandboxIdOrNameOf(request: ResourceRequest): string {
	return request.params.sandboxIdOrName || request.params.sandboxId;
}
