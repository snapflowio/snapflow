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
import { ScheduledJob } from '../../../../common/decorators/scheduled-job.decorator';
import { MachineTrafficService } from '../../../../machine/services/reports/machine-traffic.service';

@Injectable()
export class MachineTrafficResetJob {
	constructor(private readonly traffic: MachineTrafficService) {}

	@ScheduledJob(CronExpression.EVERY_HOUR, {
		name: 'reset-machine-traffic-caps',
		waitForCompletion: true,
	})
	reset(): Promise<void> {
		return this.traffic.resetMonthly();
	}
}
