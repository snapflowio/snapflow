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
import { SandboxCleanupManager } from '../../managers/sandbox-cleanup.manager';

@Injectable()
export class SandboxCleanupJob {
	constructor(private readonly sandboxCleanupManager: SandboxCleanupManager) {}

	@ScheduledJob(CronExpression.EVERY_10_MINUTES, {
		name: 'cleanup-stale-build-failed-sandboxes',
		waitForCompletion: true,
	})
	cleanupStaleBuildFailedSandboxes(): Promise<void> {
		return this.sandboxCleanupManager.cleanupStaleBuildFailedSandboxes();
	}

	@ScheduledJob(CronExpression.EVERY_10_MINUTES, {
		name: 'cleanup-stale-error-sandboxes',
		waitForCompletion: true,
	})
	cleanupStaleErrorSandboxes(): Promise<void> {
		return this.sandboxCleanupManager.cleanupStaleErrorSandboxes();
	}
}
