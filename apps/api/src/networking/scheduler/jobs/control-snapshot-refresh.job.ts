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
import { ControlSnapshotRefreshService } from '../../routing/services/control-snapshot-refresh.service';

@Injectable()
export class ControlSnapshotRefreshJob {
	constructor(
		private readonly controlSnapshotRefreshService: ControlSnapshotRefreshService
	) {}

	@ScheduledJob(CronExpression.EVERY_10_SECONDS, {
		name: 'refresh-network-control-snapshots',
		waitForCompletion: true,
		maintenanceExempt: true,
	})
	refresh(): Promise<void> {
		return this.controlSnapshotRefreshService.refresh();
	}
}
