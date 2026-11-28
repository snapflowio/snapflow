/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import { ScheduledJob } from '../../../common/decorators/scheduled-job.decorator';
import { WEBHOOK_RETENTION } from '../../constants/webhook.constants';
import { WebhookRetentionService } from '../../services/webhook-retention.service';

@Injectable()
export class WebhookRetentionJob {
	constructor(private readonly retention: WebhookRetentionService) {}

	@ScheduledJob(WEBHOOK_RETENTION.expression, {
		name: WEBHOOK_RETENTION.jobName,
		waitForCompletion: true,
	})
	prune(): Promise<void> {
		return this.retention.prune();
	}
}
