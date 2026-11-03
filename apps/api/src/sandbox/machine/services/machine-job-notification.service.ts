/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable, Logger } from '@nestjs/common';
import { ControlWakeService } from '../../../infra/control-wake/services/control-wake.service';
import { MACHINE_JOB_WAKE_TOPIC } from '../constants/machine-job-wake.constants';

@Injectable()
export class MachineJobNotificationService {
	private readonly logger = new Logger(MachineJobNotificationService.name);

	constructor(private readonly wakes: ControlWakeService) {}

	notify(machineId: string, jobId: string): void {
		this.wakes.notify(MACHINE_JOB_WAKE_TOPIC, [machineId]);
		this.logger.debug(`Notified machine ${machineId} about job ${jobId}`);
	}
}
