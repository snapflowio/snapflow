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
import { BenchmarkAppraisalService } from '../../qualification/services/benchmark-appraisal.service';

@Injectable()
export class BenchmarkAppraisalJob {
	constructor(
		private readonly benchmarkAppraisalService: BenchmarkAppraisalService
	) {}

	@ScheduledJob(CronExpression.EVERY_10_SECONDS, {
		name: BENCHMARK_JOB.APPRAISE,
		waitForCompletion: true,
	})
	appraiseSettled(): Promise<void> {
		return this.benchmarkAppraisalService.appraiseSettled();
	}
}
