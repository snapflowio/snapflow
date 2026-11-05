/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { CreateRequestContext } from '@mikro-orm/decorators/legacy';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LogExecution } from '../../common/decorators/log-execution.decorator';
import { TrackJobExecution } from '../../common/decorators/track-job-execution.decorator';
import { mapSequentially } from '../../common/utils/concurrency/sequential-async.util';
import { TrackedJobs } from '../../common/utils/concurrency/tracked-jobs.util';
import { RedisLockProvider } from '../../infra/redis/providers/redis-lock.provider';
import { MachineState } from '../../machine/enums/machine-state.enum';
import { SettingsService } from '../../settings/services/settings.service';
import {
	RETENTION_ARCHIVE_INTERVAL_MINUTES,
	SANDBOX_WORKER_LIMITS,
} from '../constants/sandbox.constants';
import { SandboxEvents } from '../constants/sandbox-events.constants';
import { Sandbox } from '../entities/sandbox.entity';
import { SandboxDesiredState } from '../enums/sandbox-desired-state.enum';
import { SandboxState } from '../enums/sandbox-state.enum';
import { SandboxArchivedEvent } from '../events/sandbox-archived.event';
import { SandboxDestroyedEvent } from '../events/sandbox-destroyed.event';
import { SandboxStoppedEvent } from '../events/sandbox-stopped.event';
import { SandboxRepository } from '../repositories/sandbox.repository';
import { hydrateSandboxes } from '../utils/hydrate-sandboxes.util';
import { getStateChangeLockKey } from '../utils/lock-key.util';
import { deletesImmediatelyOnStop } from '../utils/runtime/ephemeral.util';
import { retentionArchiveMinutes } from '../utils/runtime/sandbox-interval.util';

const LIFECYCLE_WORKER_LOCK_TTL_SECONDS = 60;
const SANDBOX_LOCK_TTL_SECONDS = 30;

interface LifecyclePolicyChange {
	updateData: Partial<Sandbox>;
	publish: (eventEmitter: EventEmitter2, updated: Sandbox) => void;
}

function stopOrDeletePolicy(sandbox: Sandbox): LifecyclePolicyChange {
	return deletesImmediatelyOnStop(sandbox)
		? deletePolicy(sandbox)
		: {
				updateData: {
					pending: true,
					desiredState: SandboxDesiredState.STOPPED,
				},
				publish: (eventEmitter, updated) =>
					eventEmitter.emit(
						SandboxEvents.STOPPED,
						new SandboxStoppedEvent(updated)
					),
			};
}

function archivePolicy(): LifecyclePolicyChange {
	return {
		updateData: { desiredState: SandboxDesiredState.ARCHIVED },
		publish: (eventEmitter, updated) =>
			eventEmitter.emit(
				SandboxEvents.ARCHIVED,
				new SandboxArchivedEvent(updated)
			),
	};
}

function deletePolicy(sandbox: Sandbox): LifecyclePolicyChange {
	return {
		updateData: Sandbox.getSoftDeleteUpdate(sandbox),
		publish: (eventEmitter, updated) =>
			eventEmitter.emit(
				SandboxEvents.DESTROYED,
				new SandboxDestroyedEvent(updated)
			),
	};
}

@Injectable()
export class SandboxIdlePolicyManager extends TrackedJobs {
	protected readonly logger = new Logger(SandboxIdlePolicyManager.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly sandboxRepository: SandboxRepository,
		private readonly redisLockProvider: RedisLockProvider,
		private readonly settings: SettingsService,
		private readonly eventEmitter: EventEmitter2
	) {
		super();
	}

	get em(): EntityManager {
		return this.entityManager;
	}

	@TrackJobExecution()
	@LogExecution('auto-stop-check')
	@CreateRequestContext()
	async autostopCheck(): Promise<void> {
		await this.applyLifecyclePolicy(
			'auto-stop-check-worker-selected',
			`SELECT sandbox.id FROM sandbox
				JOIN sandbox_last_activity activity ON activity."sandboxId" = sandbox.id
				JOIN machine ON machine.id = sandbox."machineId" AND machine.state = ?
				WHERE sandbox.state = ?
						AND sandbox."desiredState" = ? AND sandbox.pending = false
						AND sandbox."autoStopInterval" <> 0
						AND activity."lastActivityAt" < NOW() - INTERVAL '1 minute' * sandbox."autoStopInterval"
					ORDER BY sandbox."lastBackupAt" ASC, sandbox.id ASC LIMIT ?`,
			[
				MachineState.READY,
				SandboxState.STARTED,
				SandboxDesiredState.STARTED,
				SANDBOX_WORKER_LIMITS.lifecycleBatchSize,
			],
			stopOrDeletePolicy
		);
	}

	@TrackJobExecution()
	@LogExecution('auto-archive-check')
	@CreateRequestContext()
	async autoArchiveCheck(): Promise<void> {
		await this.applyLifecyclePolicy(
			'auto-archive-check-worker-selected',
			`SELECT sandbox.id FROM sandbox
			JOIN sandbox_last_activity activity ON activity."sandboxId" = sandbox.id
			WHERE sandbox.state = ? AND sandbox."desiredState" = ? AND sandbox.pending = false
				AND activity."lastActivityAt" < NOW() - INTERVAL '1 minute' * LEAST(NULLIF(sandbox."autoArchiveInterval", ?), ?)
			ORDER BY sandbox."lastBackupAt" ASC, sandbox.id ASC LIMIT ?`,
			[
				SandboxState.STOPPED,
				SandboxDesiredState.STOPPED,
				RETENTION_ARCHIVE_INTERVAL_MINUTES,
				retentionArchiveMinutes(await this.settings.get()),
				SANDBOX_WORKER_LIMITS.lifecycleBatchSize,
			],
			archivePolicy
		);
	}

	@TrackJobExecution()
	@LogExecution('auto-delete-check')
	@CreateRequestContext()
	async autoDeleteCheck(): Promise<void> {
		await this.applyLifecyclePolicy(
			'auto-delete-check-worker-selected',
			`SELECT sandbox.id FROM sandbox
				JOIN sandbox_last_activity activity ON activity."sandboxId" = sandbox.id
				JOIN machine ON machine.id = sandbox."machineId" AND machine.state = ?
				WHERE sandbox.state = ?
						AND sandbox."desiredState" = ? AND sandbox.pending = false
						AND sandbox."autoDeleteInterval" >= 0
						AND activity."lastActivityAt" < NOW() - INTERVAL '1 minute' * sandbox."autoDeleteInterval"
					ORDER BY activity."lastActivityAt" ASC, sandbox.id ASC LIMIT ?`,
			[
				MachineState.READY,
				SandboxState.STOPPED,
				SandboxDesiredState.STOPPED,
				SANDBOX_WORKER_LIMITS.lifecycleBatchSize,
			],
			deletePolicy
		);
	}

	private async applyLifecyclePolicy(
		workerLockKey: string,
		selection: string,
		bindings: unknown[],
		policyFor: (sandbox: Sandbox) => LifecyclePolicyChange
	): Promise<void> {
		await this.redisLockProvider.runExclusive(
			workerLockKey,
			LIFECYCLE_WORKER_LOCK_TTL_SECONDS,
			async () => {
				const rows = await this.entityManager.execute<{ id: string }[]>(
					selection,
					bindings
				);
				const sandboxes = await hydrateSandboxes(this.entityManager, rows);
				await mapSequentially(sandboxes, (sandbox) =>
					this.applyPolicyToSandbox(sandbox, policyFor(sandbox))
				);
			}
		);
	}

	private async applyPolicyToSandbox(
		sandbox: Sandbox,
		policy: LifecyclePolicyChange
	): Promise<void> {
		const updated = await this.redisLockProvider.runExclusive(
			getStateChangeLockKey(sandbox.id),
			SANDBOX_LOCK_TTL_SECONDS,
			async () => {
				try {
					return await this.sandboxRepository.updateWhere(sandbox.id, {
						updateData: policy.updateData,
						whereCondition: { pending: false, state: sandbox.state },
					});
				} catch (error) {
					this.logger.error(
						`Error applying lifecycle policy to sandbox ${sandbox.id}:`,
						error
					);
					return undefined;
				}
			}
		);
		if (updated) policy.publish(this.eventEmitter, updated);
	}
}
