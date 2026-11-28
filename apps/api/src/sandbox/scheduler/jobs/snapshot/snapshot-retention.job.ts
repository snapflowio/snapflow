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
import { ScheduledJob } from '../../../../common/decorators/scheduled-job.decorator';
import { BuildDataRetentionManager } from '../../../../snapshot/managers/build-data-retention.manager';
import { SnapshotRetentionManager } from '../../../../snapshot/managers/snapshot-retention.manager';

@Injectable()
export class SnapshotRetentionJob {
	constructor(
		private readonly snapshotRetentionManager: SnapshotRetentionManager,
		private readonly buildDataRetentionManager: BuildDataRetentionManager
	) {}

	@ScheduledJob(CronExpression.EVERY_MINUTE, {
		name: 'prune-machine-snapshot-targets',
	})
	pruneTargets(): Promise<void> {
		return this.snapshotRetentionManager.pruneTargets();
	}

	@ScheduledJob(CronExpression.EVERY_DAY_AT_3AM, {
		name: 'prune-build-data',
		waitForCompletion: true,
	})
	pruneBuildData(): Promise<void> {
		return this.buildDataRetentionManager.prune();
	}
}
