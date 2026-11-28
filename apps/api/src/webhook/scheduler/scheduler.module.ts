/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module } from '@nestjs/common';
import { WebhookModule } from '../webhook.module';
import { WebhookDisabledNoticeJob } from './jobs/webhook-disabled-notice.job';
import { WebhookDispatchJob } from './jobs/webhook-dispatch.job';
import { WebhookRetentionJob } from './jobs/webhook-retention.job';

@Module({
	imports: [WebhookModule],
	providers: [
		WebhookDispatchJob,
		WebhookDisabledNoticeJob,
		WebhookRetentionJob,
	],
})
export class WebhookSchedulerModule {}
