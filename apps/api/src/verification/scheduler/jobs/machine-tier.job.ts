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
import { MACHINE_TIER_JOB } from '../../qualification/constants/machine-tier.constants';
import { MachineTierService } from '../../qualification/services/machine-tier.service';

@Injectable()
export class MachineTierJob {
	constructor(private readonly machineTierService: MachineTierService) {}

	@ScheduledJob(CronExpression.EVERY_5_MINUTES, {
		name: MACHINE_TIER_JOB.EVALUATE,
		waitForCompletion: true,
	})
	evaluateAll(): Promise<void> {
		return this.machineTierService.evaluateAll();
	}
}
