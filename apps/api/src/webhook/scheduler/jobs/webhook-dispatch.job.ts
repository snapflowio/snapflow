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
import { WEBHOOK_DISPATCH } from '../../constants/webhook.constants';
import { WebhookDispatcherService } from '../../services/webhook-dispatcher.service';

@Injectable()
export class WebhookDispatchJob {
	constructor(private readonly dispatcher: WebhookDispatcherService) {}

	@ScheduledJob(WEBHOOK_DISPATCH.pollExpression, {
		name: WEBHOOK_DISPATCH.jobName,
		waitForCompletion: true,
	})
	dispatch(): Promise<void> {
		return this.dispatcher.dispatch();
	}
}
