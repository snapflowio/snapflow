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
import { MachineReliabilityRetentionService } from '../../machine/services/qualification/machine-reliability-retention.service';

@Injectable()
export class MachineReliabilityRetentionJob {
	constructor(
		private readonly machineReliabilityRetentionService: MachineReliabilityRetentionService
	) {}

	@ScheduledJob(CronExpression.EVERY_HOUR, {
		name: 'prune-machine-reliability-evidence',
		waitForCompletion: true,
	})
	prune(): Promise<void> {
		return this.machineReliabilityRetentionService.prune();
	}
}
