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
import { EarlySessionFailureService } from '../../services/usage/early-session-failure.service';

@Injectable()
export class EarlySessionFailureJob {
	constructor(private readonly earlyFailures: EarlySessionFailureService) {}

	@ScheduledJob(CronExpression.EVERY_MINUTE, {
		name: 'detect-early-session-failures',
		waitForCompletion: true,
	})
	detect(): Promise<void> {
		return this.earlyFailures.detectOpen();
	}
}
