/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { validate as isUUID } from 'uuid';
import {
	ResourceAccessGuard,
	type ResourceRequest,
} from '../../common/guards/resource-access.guard';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { ALLOW_GENERAL_SNAPSHOTS_KEY } from '../decorators/allow-general-snapshots.decorator';
import type { Snapshot } from '../entities/snapshot.entity';
import { SnapshotService } from '../services/snapshot.service';

@Injectable()
export class SnapshotAccessGuard extends ResourceAccessGuard {
	constructor(
		private readonly reflector: Reflector,
		private readonly snapshotService: SnapshotService
	) {
		super();
	}

	protected async organizationIdOf(
		request: ResourceRequest,
		authContext: OrganizationAuthContext,
		context: ExecutionContext
	): Promise<string | null> {
		const snapshot = await this.resolveSnapshot(
			request.params.id,
			authContext.organizationId
		);
		return snapshot.general && this.allowsGeneral(context)
			? authContext.organizationId
			: (snapshot.organizationId ?? null);
	}

	protected notFoundMessage(request: ResourceRequest): string {
		return `Snapshot with ID or name ${request.params.id} not found`;
	}

	private resolveSnapshot(
		idOrName: string,
		organizationId: string
	): Promise<Snapshot> {
		return isUUID(idOrName)
			? this.snapshotService.getSnapshot(idOrName)
			: this.snapshotService.getSnapshotByName(idOrName, organizationId);
	}

	private allowsGeneral(context: ExecutionContext): boolean {
		return (
			this.reflector.get<boolean | undefined>(
				ALLOW_GENERAL_SNAPSHOTS_KEY,
				context.getHandler()
			) === true
		);
	}
}
