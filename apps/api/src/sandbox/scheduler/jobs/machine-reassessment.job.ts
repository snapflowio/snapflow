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
import { MachineReassessmentService } from '../../machine/services/qualification/machine-reassessment.service';

@Injectable()
export class MachineReassessmentJob {
	constructor(
		private readonly machineReassessmentService: MachineReassessmentService
	) {}

	@ScheduledJob(CronExpression.EVERY_MINUTE, {
		name: 'reassess-due-machines',
		waitForCompletion: true,
	})
	reassessDue(): Promise<void> {
		return this.machineReassessmentService.reassessDue();
	}
}
