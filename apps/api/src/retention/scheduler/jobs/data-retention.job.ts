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
import { DATA_RETENTION } from '../../constants/data-retention.constants';
import { DataRetentionService } from '../../services/data-retention.service';

@Injectable()
export class DataRetentionJob {
	constructor(private readonly retention: DataRetentionService) {}

	@ScheduledJob(CronExpression.EVERY_HOUR, {
		name: DATA_RETENTION.JOB,
		waitForCompletion: true,
	})
	prune(): Promise<void> {
		return this.retention.prune();
	}
}
