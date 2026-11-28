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
import { SettingsService } from '../../settings/services/settings.service';
import type {
	OrganizationSettingsDto,
	UpdateOrganizationSettingsDto,
} from '../dto/organization-settings.dto';
import { Organization } from '../entities/organization.entity';
import { archiveAfterStoppedDays } from '../utils/archive-after-stopped.util';
import { OrganizationService } from './organization.service';
import { OrganizationLimitsService } from './organization-limits.service';

@Injectable()
export class OrganizationSettingsService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly organizations: OrganizationService,
		private readonly limits: OrganizationLimitsService,
		private readonly settings: SettingsService
	) {}

	async get(organizationId: string): Promise<OrganizationSettingsDto> {
		const [organization, limits, settings] = await Promise.all([
			this.organizations.findOneOrFail(organizationId),
			this.limits.get(organizationId),
			this.settings.get(),
		]);
		return {
			telemetryEnabled: organization.telemetryEnabled,
			sandboxLimitedNetworkEgress: limits.sandboxLimitedNetworkEgress,
			archiveAfterStoppedDays: archiveAfterStoppedDays(limits, settings),
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
		const { sandboxLimitedNetworkEgress, archiveAfterStoppedDays } = changes;
		if (
			sandboxLimitedNetworkEgress !== undefined ||
			archiveAfterStoppedDays !== undefined
		) {
			await this.limits.update(organizationId, {
				...(sandboxLimitedNetworkEgress !== undefined && {
					sandboxLimitedNetworkEgress,
				}),
				...(archiveAfterStoppedDays !== undefined && {
					archiveAfterStoppedDays,
				}),
			});
		}
		return this.get(organizationId);
	}
}
