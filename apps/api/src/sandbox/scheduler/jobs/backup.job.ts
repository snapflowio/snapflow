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
import { BackupManager } from '../../instance/managers/backup/backup.manager';

@Injectable()
export class BackupJob {
	constructor(private readonly backupManager: BackupManager) {}

	@ScheduledJob(CronExpression.EVERY_10_SECONDS, {
		name: BackupJobName.CHECK_PENDING,
		waitForCompletion: true,
	})
	checkBackupStates(): Promise<void> {
		return this.backupManager.checkBackupStates();
	}

	@ScheduledJob(CronExpression.EVERY_10_SECONDS, {
		name: BackupJobName.CHECK_IN_PROGRESS,
		waitForCompletion: true,
	})
	checkBackupStatesInProgress(): Promise<void> {
		return this.backupManager.checkBackupStatesInProgress();
	}

	@ScheduledJob(CronExpression.EVERY_10_SECONDS, {
		name: BackupJobName.CHECK_ERRORED_DRAINING,
	})
	checkBackupStatesForErroredDraining(): Promise<void> {
		return this.backupManager.checkBackupStatesForErroredDraining();
	}

	@ScheduledJob(CronExpression.EVERY_10_SECONDS, {
		name: BackupJobName.SYNC_STOP_STATE,
	})
	syncStopStateCreateBackups(): Promise<void> {
		return this.backupManager.syncStopStateCreateBackups();
	}
}
