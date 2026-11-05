/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	ConflictException,
	ForbiddenException,
	Injectable,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { softDeleteOrganization } from '../../organization/better-auth/organization-deletion';
import { ORGANIZATION_HAS_LIVE_RESOURCES_CODE } from '../../organization/constants/live-organization-resource.constants';
import { ORGANIZATION_ERROR } from '../../organization/constants/organization-errors.constants';
import { OrganizationService } from '../../organization/services/organization.service';
import { OrganizationOwnershipService } from '../../organization/services/organization-ownership.service';
import type { Auth } from '../better-auth/better-auth.config';
import { InjectBetterAuth } from '../better-auth/better-auth.provider';

@Injectable()
export class OrganizationDeletionService {
	constructor(
		@InjectBetterAuth() private readonly auth: Auth,
		private readonly eventEmitter: EventEmitter2,
		private readonly organizations: OrganizationService,
		private readonly ownership: OrganizationOwnershipService
	) {}

	async delete(organizationId: string): Promise<void> {
		const organization = await this.organizations.findOneOrFail(organizationId);
		if (organization.personal) {
			throw new ForbiddenException(
				ORGANIZATION_ERROR.PERSONAL_ORGANIZATION_UNDELETABLE
			);
		}
		const liveResources =
			await this.ownership.findLiveResources(organizationId);
		if (liveResources.length > 0) {
			throw new ConflictException({
				code: ORGANIZATION_HAS_LIVE_RESOURCES_CODE,
				message: `The organization still owns ${liveResources.join(', ')}. Delete them before deleting the organization.`,
			});
		}
		await softDeleteOrganization(
			await this.auth.$context,
			this.eventEmitter,
			organizationId
		);
	}
}
