/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ScheduledJob } from '../../../common/decorators/scheduled-job.decorator';
import { ORGANIZATION_SUSPENSION } from '../../tenant/constants/organization-suspension.constants';
import { OrganizationSuspensionService } from '../../tenant/services/organization-suspension.service';

@Injectable()
export class OrganizationSuspensionJob {
	constructor(
		private readonly organizationSuspensionService: OrganizationSuspensionService
	) {}

	@ScheduledJob(CronExpression.EVERY_MINUTE, {
		name: ORGANIZATION_SUSPENSION.STOP_SANDBOXES_LOCK_KEY,
	})
	stopSuspendedOrganizationSandboxes(): Promise<void> {
		return this.organizationSuspensionService.stopSuspendedOrganizationSandboxes();
	}

	@ScheduledJob(CronExpression.EVERY_MINUTE, {
		name: ORGANIZATION_SUSPENSION.DEACTIVATE_SNAPSHOTS_LOCK_KEY,
	})
	deactivateSuspendedOrganizationSnapshots(): Promise<void> {
		return this.organizationSuspensionService.deactivateSuspendedOrganizationSnapshots();
	}
}
