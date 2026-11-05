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
import { IsolatedEntityManagerContext } from '../../common/decorators/isolated-entity-manager-context.decorator';
import { OnAsyncEvent } from '../../common/decorators/on-async-event.decorator';
import { TrackJobExecution } from '../../common/decorators/track-job-execution.decorator';
import { TrackedJobs } from '../../common/utils/concurrency/tracked-jobs.util';
import { millisecondsBetween } from '../../common/utils/time.util';
import { RedisLockProvider } from '../../infra/redis/providers/redis-lock.provider';
import { JobConflictException } from '../../machine-job/exceptions/job-conflict.exception';
import { SandboxEvents } from '../constants/sandbox-events.constants';
import { Sandbox } from '../entities/sandbox.entity';
import { SandboxDesiredState } from '../enums/sandbox-desired-state.enum';
import { SandboxState } from '../enums/sandbox-state.enum';
import { SandboxArchivedEvent } from '../events/sandbox-archived.event';
import { SandboxCreatedEvent } from '../events/sandbox-create.event';
import { SandboxDestroyedEvent } from '../events/sandbox-destroyed.event';
import { SandboxStartedEvent } from '../events/sandbox-started.event';
import { SandboxStoppedEvent } from '../events/sandbox-stopped.event';
import { SandboxConflictException } from '../exceptions/sandbox-conflict.exception';
import { SandboxRepository } from '../repositories/sandbox.repository';
import { getStateChangeLockKey } from '../utils/lock-key.util';
import { sanitizeSandboxError } from '../utils/sanitize-error.util';
import {
	DONT_SYNC_AGAIN,
	SYNC_AGAIN,
	type SyncState,
} from './actions/sandbox.action';
import { SandboxArchiveAction } from './actions/sandbox-archive.action';
import { SandboxDestroyAction } from './actions/sandbox-destroy.action';
import { SandboxStartAction } from './actions/sandbox-start.action';
import { SandboxStopAction } from './actions/sandbox-stop.action';

const SANDBOX_LOCK_TTL_SECONDS = 30;
const STATE_SYNC_BUDGET_MS = 10_000;

@Injectable()
export class SandboxManager extends TrackedJobs {
	protected readonly logger = new Logger(SandboxManager.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly sandboxRepository: SandboxRepository,
		private readonly redisLockProvider: RedisLockProvider,
		private readonly sandboxStartAction: SandboxStartAction,
		private readonly sandboxStopAction: SandboxStopAction,
		private readonly sandboxDestroyAction: SandboxDestroyAction,
		private readonly sandboxArchiveAction: SandboxArchiveAction
	) {
		super();
	}

	async syncInstanceState(sandboxId: string, force?: boolean): Promise<void> {
		const startedAt = new Date();

		await this.redisLockProvider.runExclusive(
			getStateChangeLockKey(sandboxId),
			SANDBOX_LOCK_TTL_SECONDS,
			async () => {
				const sandbox = await this.entityManager.findOneOrFail(Sandbox, {
					id: sandboxId,
				});

				while (
					millisecondsBetween(startedAt, new Date()) <= STATE_SYNC_BUDGET_MS
				) {
					if (!(await this.syncOnce(sandbox, force))) {
						break;
					}
				}
			}
		);
	}

	private async syncOnce(sandbox: Sandbox, force?: boolean): Promise<boolean> {
		if (sandbox.isStateSynchronizationTerminal()) {
			return false;
		}

		if (String(sandbox.state) === String(sandbox.desiredState)) {
			this.logger.warn(
				`Sandbox ${sandbox.id} is already in the desired state ${sandbox.desiredState}, skipping sync`
			);
			return false;
		}

		let syncState: SyncState;
		try {
			syncState = await this.runDesiredStateAction(sandbox, force);
		} catch (error) {
			await this.handleSyncError(sandbox, error);
			return false;
		}

		if (sandbox.machineId && sandbox.state !== SandboxState.UNKNOWN) {
			return false;
		}

		return syncState === SYNC_AGAIN;
	}

	private async runDesiredStateAction(
		sandbox: Sandbox,
		force?: boolean
	): Promise<SyncState> {
		switch (sandbox.desiredState) {
			case SandboxDesiredState.STARTED:
				return this.sandboxStartAction.run(sandbox);
			case SandboxDesiredState.STOPPED:
				return this.sandboxStopAction.run(sandbox, force);
			case SandboxDesiredState.DESTROYED:
				return this.sandboxDestroyAction.run(sandbox);
			case SandboxDesiredState.ARCHIVED:
				return this.sandboxArchiveAction.run(sandbox);
		}
		return DONT_SYNC_AGAIN;
	}

	private async handleSyncError(
		sandbox: Sandbox,
		error: unknown
	): Promise<void> {
		if (error instanceof SandboxConflictException) {
			this.logger.warn(
				`Sandbox ${sandbox.id} was modified by another operation during sync, skipping error transition`
			);
			return;
		}

		if (error instanceof JobConflictException) {
			this.logger.debug(
				`Job already in progress for sandbox ${sandbox.id}, skipping`
			);
			return;
		}

		this.logger.error(
			`Error processing desired state for sandbox ${sandbox.id}:`,
			error
		);

		const { recoverable, errorReason } = sanitizeSandboxError(error);

		await this.sandboxRepository.updateWhere(sandbox.id, {
			updateData: {
				state: SandboxState.ERROR,
				errorReason,
				recoverable,
			},
			whereCondition: {
				state: sandbox.state,
				specGeneration: sandbox.specGeneration,
			},
		});
	}

	@OnAsyncEvent({
		event: SandboxEvents.ARCHIVED,
	})
	@TrackJobExecution()
	@IsolatedEntityManagerContext()
	private async handleSandboxArchivedEvent(event: SandboxArchivedEvent) {
		await this.syncInstanceState(event.sandbox.id);
	}

	@OnAsyncEvent({
		event: SandboxEvents.DESTROYED,
	})
	@TrackJobExecution()
	@IsolatedEntityManagerContext()
	private async handleSandboxDestroyedEvent(event: SandboxDestroyedEvent) {
		await this.syncInstanceState(event.sandbox.id);
	}

	@OnAsyncEvent({
		event: SandboxEvents.STARTED,
	})
	@TrackJobExecution()
	@IsolatedEntityManagerContext()
	private async handleSandboxStartedEvent(event: SandboxStartedEvent) {
		await this.syncInstanceState(event.sandbox.id);
	}

	@OnAsyncEvent({
		event: SandboxEvents.STOPPED,
	})
	@TrackJobExecution()
	@IsolatedEntityManagerContext()
	private async handleSandboxStoppedEvent(event: SandboxStoppedEvent) {
		await this.syncInstanceState(event.sandbox.id, event.force);
	}

	@OnAsyncEvent({
		event: SandboxEvents.CREATED,
	})
	@TrackJobExecution()
	@IsolatedEntityManagerContext()
	private async handleSandboxCreatedEvent(event: SandboxCreatedEvent) {
		await this.syncInstanceState(event.sandbox.id);
	}
}
