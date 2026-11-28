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
import { IDLE_MACHINE_NOTICE } from '../../constants/marketplace.constants';
import { IdleMachineNoticeService } from '../../services/idle-machine-notice.service';

@Injectable()
export class IdleMachineNoticeJob {
	constructor(private readonly notices: IdleMachineNoticeService) {}

	@ScheduledJob(CronExpression.EVERY_WEEK, {
		name: IDLE_MACHINE_NOTICE.JOB,
		waitForCompletion: true,
	})
	scan(): Promise<void> {
		return this.notices.scan();
	}
}
