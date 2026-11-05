/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module } from '@nestjs/common';
import { VerificationModule } from '../verification.module';
import { BenchmarkAppraisalJob } from './jobs/benchmark-appraisal.job';
import { MachineBenchmarkJob } from './jobs/machine-benchmark.job';
import { MachineTierJob } from './jobs/machine-tier.job';
import { NetworkMeterAuditJob } from './jobs/network-meter-audit.job';
import { SpotCheckExecutorJob } from './jobs/spot-check-executor.job';
import { SpotCheckSchedulerJob } from './jobs/spot-check-scheduler.job';

@Module({
	imports: [VerificationModule],
	providers: [
		BenchmarkAppraisalJob,
		MachineBenchmarkJob,
		MachineTierJob,
		NetworkMeterAuditJob,
		SpotCheckExecutorJob,
		SpotCheckSchedulerJob,
	],
})
export class VerificationSchedulerModule {}
