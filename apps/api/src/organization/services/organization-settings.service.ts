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
import type {
	OrganizationSettingsDto,
	UpdateOrganizationSettingsDto,
} from '../dto/organization-settings.dto';
import { Organization } from '../entities/organization.entity';
import { OrganizationService } from './organization.service';
import { OrganizationLimitsService } from './organization-limits.service';

@Injectable()
export class OrganizationSettingsService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly organizations: OrganizationService,
		private readonly limits: OrganizationLimitsService
	) {}

	async get(organizationId: string): Promise<OrganizationSettingsDto> {
		const organization = await this.organizations.findOneOrFail(organizationId);
		const limits = await this.limits.get(organizationId);
		return {
			telemetryEnabled: organization.telemetryEnabled,
			sandboxLimitedNetworkEgress: limits.sandboxLimitedNetworkEgress,
		};
	}

	async update(
		organizationId: string,
		changes: UpdateOrganizationSettingsDto
	): Promise<OrganizationSettingsDto> {
		if (changes.telemetryEnabled !== undefined) {
			const { telemetryEnabled } = changes;
			await this.entityManager.transactional((manager) =>
				manager.nativeUpdate(
					Organization,
					{ id: organizationId },
					{ telemetryEnabled }
				)
			);
		}
		if (changes.sandboxLimitedNetworkEgress !== undefined) {
			await this.limits.update(organizationId, {
				sandboxLimitedNetworkEgress: changes.sandboxLimitedNetworkEgress,
			});
		}
		return this.get(organizationId);
	}
}
