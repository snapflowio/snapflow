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
import { MACHINE_HEALTH_CHECK } from '../../../machine/constants/machine.constants';
import { MachineHealthService } from '../../../machine/services/machine-health.service';

@Injectable()
export class MachineHealthJob {
	constructor(private readonly machineHealthService: MachineHealthService) {}

	@ScheduledJob(CronExpression.EVERY_10_SECONDS, {
		name: MACHINE_HEALTH_CHECK.JOB_NAME,
		waitForCompletion: true,
	})
	handleCheckMachines(): Promise<void> {
		return this.machineHealthService.handleCheckMachines();
	}
}
