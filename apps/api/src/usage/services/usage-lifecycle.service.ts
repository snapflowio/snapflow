/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IsolatedEntityManagerContext } from '../../common/decorators/isolated-entity-manager-context.decorator';
import { TrackJobExecution } from '../../common/decorators/track-job-execution.decorator';
import { TrackedJobs } from '../../common/utils/concurrency/tracked-jobs.util';
import { SandboxEvents } from '../../sandbox/constants/sandbox-events.constants';
import { Sandbox } from '../../sandbox/entities/sandbox.entity';
import type { SandboxEvent } from '../../sandbox/events/sandbox.event';
import { sandboxUsageMode } from '../utils/usage-mode.util';
import { UsageLockService } from './usage-lock.service';
import { UsagePeriodService } from './usage-period.service';

@Injectable()
export class UsageLifecycleService extends TrackedJobs {
	protected readonly logger = new Logger(UsageLifecycleService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly locks: UsageLockService,
		private readonly periods: UsagePeriodService
	) {
		super();
	}

	@OnEvent(SandboxEvents.STATE_UPDATED)
	@OnEvent(SandboxEvents.DESIRED_STATE_UPDATED)
	@OnEvent(SandboxEvents.MACHINE_UPDATED)
	@TrackJobExecution()
	@IsolatedEntityManagerContext()
	async handleSandboxUpdate(event: SandboxEvent): Promise<void> {
		await this.locks.withSandboxLock(event.sandbox.id, async () => {
			const sandbox = await this.entityManager.findOne(Sandbox, {
				id: event.sandbox.id,
			});
			if (sandbox) {
				await this.periods.transition(sandbox, sandboxUsageMode(sandbox));
			}
		});
	}
}
