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
import { SnapshotLifecycleManager } from '../../snapshot/managers/snapshot-lifecycle.manager';

@Injectable()
export class SnapshotLifecycleJob {
	constructor(
		private readonly snapshotLifecycleManager: SnapshotLifecycleManager
	) {}

	@ScheduledJob(CronExpression.EVERY_30_SECONDS, {
		name: 'check-snapshot-state',
	})
	checkSnapshotState(): Promise<void> {
		return this.snapshotLifecycleManager.checkSnapshotState();
	}
}
