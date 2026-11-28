/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import { ScheduledJob } from '../../../common/decorators/scheduled-job.decorator';
import { QUOTA_TIER_SWEEP } from '../../constants/organization-quota-tier.constants';
import { OrganizationQuotaTierService } from '../../services/organization-quota-tier.service';

@Injectable()
export class OrganizationQuotaTierJob {
	constructor(private readonly quotaTiers: OrganizationQuotaTierService) {}

	@ScheduledJob(QUOTA_TIER_SWEEP.expression, {
		name: QUOTA_TIER_SWEEP.jobName,
	})
	evaluateQuotaTiers(): Promise<void> {
		return this.quotaTiers.sweep();
	}
}
