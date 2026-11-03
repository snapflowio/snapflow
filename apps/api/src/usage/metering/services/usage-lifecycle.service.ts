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
import { IsolatedEntityManagerContext } from '../../../common/decorators/isolated-entity-manager-context.decorator';
import { TrackJobExecution } from '../../../common/decorators/track-job-execution.decorator';
import { TrackedJobs } from '../../../common/utils/concurrency/tracked-jobs.util';
import { SandboxEvents } from '../../../sandbox/instance/constants/sandbox-events.constants';
import { Sandbox } from '../../../sandbox/instance/entities/sandbox.entity';
import { SandboxDesiredState } from '../../../sandbox/instance/enums/sandbox-desired-state.enum';
import { SandboxState } from '../../../sandbox/instance/enums/sandbox-state.enum';
import { SandboxDesiredStateUpdatedEvent } from '../../../sandbox/instance/events/sandbox-desired-state-updated.event';
import { SandboxMachineUpdatedEvent } from '../../../sandbox/instance/events/sandbox-machine-updated.event';
import { SandboxStateUpdatedEvent } from '../../../sandbox/instance/events/sandbox-state-updated.event';
import { UsageMode } from '../constants/usage-lifecycle.constants';
import { SandboxUsagePeriod } from '../entities/sandbox-usage-period.entity';
import { usageModeForState } from '../utils/usage-mode.util';
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

	@OnEvent(SandboxEvents.DESIRED_STATE_UPDATED)
	@TrackJobExecution()
	@IsolatedEntityManagerContext()
	async handleSandboxDesiredStateUpdate(
		event: SandboxDesiredStateUpdatedEvent
	): Promise<void> {
		if (event.newDesiredState !== SandboxDesiredState.DESTROYED) return;
		await this.withCurrentSandbox(event.sandbox.id, (sandbox) =>
			this.periods.transition(sandbox, null)
		);
	}

	@OnEvent(SandboxEvents.STATE_UPDATED)
	@TrackJobExecution()
	@IsolatedEntityManagerContext()
	async handleSandboxStateUpdate(
		event: SandboxStateUpdatedEvent
	): Promise<void> {
		await this.withCurrentSandbox(event.sandbox.id, (sandbox) =>
			this.transitionForState(sandbox, event.newState)
		);
	}

	@OnEvent(SandboxEvents.MACHINE_UPDATED)
	@TrackJobExecution()
	@IsolatedEntityManagerContext()
	async handleSandboxMachineUpdate(
		event: SandboxMachineUpdatedEvent
	): Promise<void> {
		await this.withCurrentSandbox(event.sandbox.id, (sandbox) =>
			this.periods.transition(
				sandbox,
				sandbox.machineId ? usageModeForState(sandbox.state) : null
			)
		);
	}

	private async withCurrentSandbox(
		sandboxId: string,
		operation: (sandbox: Sandbox) => Promise<void>
	): Promise<void> {
		await this.locks.withSandboxLock(sandboxId, async () => {
			const sandbox = await this.entityManager.findOne(Sandbox, {
				id: sandboxId,
			});
			if (sandbox) await operation(sandbox);
		});
	}

	private async transitionForState(
		sandbox: Sandbox,
		state: SandboxState
	): Promise<void> {
		switch (state) {
			case SandboxState.STARTED:
				await this.periods.transition(sandbox, UsageMode.FULL);
				break;
			case SandboxState.STOPPING:
			case SandboxState.PAUSING:
				await this.periods.transition(sandbox, UsageMode.DISK);
				break;
			case SandboxState.STOPPED:
			case SandboxState.PAUSED: {
				const computePeriod = await this.entityManager.findOne(
					SandboxUsagePeriod,
					{ sandboxId: sandbox.id, endAt: null, mode: UsageMode.FULL }
				);
				if (computePeriod) {
					await this.periods.transition(sandbox, UsageMode.DISK);
				}
				break;
			}
			case SandboxState.ERROR:
			case SandboxState.BUILD_FAILED:
			case SandboxState.ARCHIVED:
			case SandboxState.DESTROYING:
			case SandboxState.DESTROYED:
				await this.periods.transition(sandbox, null);
				break;
		}
	}
}
