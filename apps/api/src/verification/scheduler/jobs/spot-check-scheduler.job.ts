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
import { SPOT_CHECK_JOB } from '../../qualification/constants/spot-check.constants';
import { SpotCheckSchedulerService } from '../../qualification/services/spot-check-scheduler.service';

@Injectable()
export class SpotCheckSchedulerJob {
	constructor(
		private readonly spotCheckSchedulerService: SpotCheckSchedulerService
	) {}

	@ScheduledJob(CronExpression.EVERY_HOUR, {
		name: SPOT_CHECK_JOB.SCHEDULE,
		waitForCompletion: true,
	})
	schedule(): Promise<void> {
		return this.spotCheckSchedulerService.schedule();
	}
}
