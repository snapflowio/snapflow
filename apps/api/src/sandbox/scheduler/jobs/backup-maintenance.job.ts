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
import { BackupJobName } from '../../instance/constants/backup.constants';
import { BackupMaintenanceManager } from '../../instance/managers/backup/backup-maintenance.manager';

@Injectable()
export class BackupMaintenanceJob {
	constructor(
		private readonly backupMaintenanceManager: BackupMaintenanceManager
	) {}

	@ScheduledJob(CronExpression.EVERY_10_MINUTES, {
		name: BackupJobName.CHECK_STALE,
	})
	checkStaleInProgressBackups(): Promise<void> {
		return this.backupMaintenanceManager.checkStaleInProgressBackups();
	}

	@ScheduledJob(CronExpression.EVERY_10_MINUTES, {
		name: BackupJobName.RETRY_ERRORED,
		waitForCompletion: true,
	})
	retryErroredBackups(): Promise<void> {
		return this.backupMaintenanceManager.retryErroredBackups();
	}
}
