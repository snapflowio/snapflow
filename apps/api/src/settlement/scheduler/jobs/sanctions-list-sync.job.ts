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
import { SANCTIONS_LIST_SYNC } from '../../constants/sanctions.constants';
import { SanctionsListSyncService } from '../services/sanctions/sanctions-list-sync.service';

@Injectable()
export class SanctionsListSyncJob {
	constructor(private readonly sanctionsList: SanctionsListSyncService) {}

	@ScheduledJob(CronExpression.EVERY_10_MINUTES, {
		name: SANCTIONS_LIST_SYNC.JOB,
		waitForCompletion: true,
	})
	tick(): Promise<void> {
		return this.sanctionsList.tick();
	}
}
