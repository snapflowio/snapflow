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
import { SnapshotPropagationManager } from '../../../snapshot/managers/snapshot-propagation.manager';

@Injectable()
export class SnapshotPropagationJob {
	constructor(
		private readonly snapshotPropagationManager: SnapshotPropagationManager
	) {}

	@ScheduledJob(CronExpression.EVERY_5_SECONDS, {
		name: 'propagate-machine-snapshots',
		waitForCompletion: true,
	})
	propagateSnapshots(): Promise<void> {
		return this.snapshotPropagationManager.propagateSnapshots();
	}

	@ScheduledJob(CronExpression.EVERY_MINUTE, {
		name: 'scale-down-machine-snapshots',
		waitForCompletion: true,
	})
	scaleDownSnapshots(): Promise<void> {
		return this.snapshotPropagationManager.scaleDownSnapshots();
	}
}
