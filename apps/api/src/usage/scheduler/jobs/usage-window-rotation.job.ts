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
import { USAGE_JOB } from '../../constants/usage-lifecycle.constants';
import { UsageWindowRotationService } from '../../services/usage-window-rotation.service';

@Injectable()
export class UsageWindowRotationJob {
	constructor(
		private readonly usageWindowRotationService: UsageWindowRotationService
	) {}

	@ScheduledJob(CronExpression.EVERY_MINUTE, {
		name: USAGE_JOB.WINDOW_ROTATION,
	})
	closeAndReopenUsagePeriods(): Promise<void> {
		return this.usageWindowRotationService.closeAndReopenUsagePeriods();
	}
}
