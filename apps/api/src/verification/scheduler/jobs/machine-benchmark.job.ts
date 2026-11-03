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
import { BENCHMARK_JOB } from '../../qualification/constants/benchmark-policy.constants';
import { MachineBenchmarkService } from '../../qualification/services/machine-benchmark.service';

@Injectable()
export class MachineBenchmarkJob {
	constructor(
		private readonly machineBenchmarkService: MachineBenchmarkService
	) {}

	@ScheduledJob(CronExpression.EVERY_MINUTE, {
		name: BENCHMARK_JOB.ISSUE,
		waitForCompletion: true,
	})
	issueDue(): Promise<void> {
		return this.machineBenchmarkService.issueDue();
	}
}
