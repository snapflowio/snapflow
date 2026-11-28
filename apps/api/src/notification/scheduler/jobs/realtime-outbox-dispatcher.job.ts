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
import { REALTIME_OUTBOX } from '../../constants/realtime-outbox.constants';
import { RealtimeOutboxDispatcherService } from '../../services/realtime-outbox-dispatcher.service';

@Injectable()
export class RealtimeOutboxDispatcherJob {
	constructor(
		private readonly realtimeOutboxDispatcherService: RealtimeOutboxDispatcherService
	) {}

	@ScheduledJob(REALTIME_OUTBOX.pollExpression, {
		name: 'dispatch-realtime-outbox',
		waitForCompletion: true,
	})
	dispatch(): Promise<void> {
		return this.realtimeOutboxDispatcherService.dispatch();
	}
}
