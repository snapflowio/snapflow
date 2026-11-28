/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification.module';
import { SignerNoticeScanService } from '../services/signer-notice-scan.service';
import { RealtimeOutboxDispatcherJob } from './jobs/realtime-outbox-dispatcher.job';
import { SignerNoticeScanJob } from './jobs/signer-notice-scan.job';
import { RealtimeOutboxMetricsService } from './services/realtime-outbox-metrics.service';

@Module({
	imports: [NotificationModule],
	providers: [
		RealtimeOutboxDispatcherJob,
		RealtimeOutboxMetricsService,
		SignerNoticeScanService,
		SignerNoticeScanJob,
	],
})
export class NotificationSchedulerModule {}
