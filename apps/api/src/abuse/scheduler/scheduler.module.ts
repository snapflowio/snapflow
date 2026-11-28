/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module } from '@nestjs/common';
import { RedisConnectionModule } from '../../infra/redis/redis.module';
import { AbuseModule } from '../abuse.module';
import { AbuseRetentionService } from '../services/abuse-retention.service';
import { AbuseCounterNoticeJob } from './jobs/abuse-counter-notice.job';
import { AbuseRetentionJob } from './jobs/abuse-retention.job';
import { AbuseThrottleReleaseJob } from './jobs/abuse-throttle-release.job';
import { AbuseReportMetricsService } from './services/abuse-report-metrics.service';

@Module({
	imports: [AbuseModule, RedisConnectionModule],
	providers: [
		AbuseCounterNoticeJob,
		AbuseReportMetricsService,
		AbuseRetentionJob,
		AbuseRetentionService,
		AbuseThrottleReleaseJob,
	],
})
export class AbuseSchedulerModule {}
