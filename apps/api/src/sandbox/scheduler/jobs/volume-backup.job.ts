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
import { VolumeBackupJobName } from '../../../volume/constants/volume-backup.constants';
import { VolumeBackupRetentionManager } from '../../../volume/managers/volume-backup-retention.manager';
import { VolumeBackupScheduleManager } from '../../managers/backup/volume-backup-schedule.manager';

@Injectable()
export class VolumeBackupJob {
	constructor(
		private readonly scheduleManager: VolumeBackupScheduleManager,
		private readonly retentionManager: VolumeBackupRetentionManager
	) {}

	@ScheduledJob(CronExpression.EVERY_MINUTE, {
		name: VolumeBackupJobName.SCHEDULE_RUNNING,
		waitForCompletion: true,
	})
	scheduleRunningVolumeBackups(): Promise<void> {
		return this.scheduleManager.scheduleRunningVolumeBackups();
	}

	@ScheduledJob(CronExpression.EVERY_10_MINUTES, {
		name: VolumeBackupJobName.PRUNE,
		waitForCompletion: true,
	})
	pruneVolumeBackups(): Promise<void> {
		return this.retentionManager.pruneVolumeBackups();
	}
}
