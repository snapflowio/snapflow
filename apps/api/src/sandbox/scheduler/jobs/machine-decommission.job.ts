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
import { MACHINE_DECOMMISSION_CHECK } from '../../machine/constants/machine.constants';
import { MachineDecommissionService } from '../../machine/services/machine-decommission.service';

@Injectable()
export class MachineDecommissionJob {
	constructor(
		private readonly machineDecommissionService: MachineDecommissionService
	) {}

	@ScheduledJob(CronExpression.EVERY_10_SECONDS, {
		name: MACHINE_DECOMMISSION_CHECK.JOB_NAME,
		waitForCompletion: true,
	})
	handleCheckDecommissionMachines(): Promise<void> {
		return this.machineDecommissionService.handleCheckDecommissionMachines();
	}
}
