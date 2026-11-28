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
import { WEBHOOK_DISABLED_NOTICE } from '../../constants/webhook.constants';
import { WebhookDisabledNoticeService } from '../../services/webhook-disabled-notice.service';

@Injectable()
export class WebhookDisabledNoticeJob {
	constructor(private readonly notices: WebhookDisabledNoticeService) {}

	@ScheduledJob(WEBHOOK_DISABLED_NOTICE.expression, {
		name: WEBHOOK_DISABLED_NOTICE.jobName,
		waitForCompletion: true,
	})
	send(): Promise<void> {
		return this.notices.send();
	}
}
