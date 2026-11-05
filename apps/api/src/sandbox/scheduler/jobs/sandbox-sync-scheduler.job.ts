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
import { SandboxSyncScheduler } from '../../managers/sandbox-sync-scheduler.manager';

@Injectable()
export class SandboxSyncSchedulerJob {
	constructor(private readonly sandboxSyncScheduler: SandboxSyncScheduler) {}

	@ScheduledJob(CronExpression.EVERY_10_SECONDS, {
		name: 'sync-states-per-machine-locked',
	})
	syncStates(): Promise<void> {
		return this.sandboxSyncScheduler.syncStates();
	}

	@ScheduledJob(CronExpression.EVERY_5_SECONDS, {
		name: 'sync-restoring-states',
	})
	syncRestoringStates(): Promise<void> {
		return this.sandboxSyncScheduler.syncRestoringStates();
	}

	@ScheduledJob(CronExpression.EVERY_MINUTE, {
		name: 'sweep-migrations-on-unavailable-machines',
	})
	sweepMigrationsOnUnavailableMachines(): Promise<void> {
		return this.sandboxSyncScheduler.sweepMigrationsOnUnavailableMachines();
	}

	@ScheduledJob(CronExpression.EVERY_10_SECONDS, {
		name: 'sync-archived-desired-states',
	})
	syncArchivedDesiredStates(): Promise<void> {
		return this.sandboxSyncScheduler.syncArchivedDesiredStates();
	}

	@ScheduledJob(CronExpression.EVERY_10_SECONDS, {
		name: 'sync-archived-completed-states',
	})
	syncArchivedCompletedStates(): Promise<void> {
		return this.sandboxSyncScheduler.syncArchivedCompletedStates();
	}
}
