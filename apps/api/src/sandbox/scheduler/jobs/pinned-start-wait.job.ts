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
import { SANDBOX_LEASE_JOB } from '../../constants/sandbox-placement.constants';
import { PinnedStartWaitManager } from '../../managers/pinned-start-wait.manager';

@Injectable()
export class PinnedStartWaitJob {
	constructor(
		private readonly pinnedStartWaitManager: PinnedStartWaitManager
	) {}

	@ScheduledJob(CronExpression.EVERY_MINUTE, {
		name: SANDBOX_LEASE_JOB.PINNED_START_WAIT,
	})
	settleStartWaits(): Promise<void> {
		return this.pinnedStartWaitManager.settleStartWaits();
	}
}
