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
import { MINUTES_PER_DAY } from '../../common/constants/time.constants';
import { LogExecution } from '../../common/decorators/log-execution.decorator';
import { TrackJobExecution } from '../../common/decorators/track-job-execution.decorator';
import { mapSequentially } from '../../common/utils/concurrency/sequential-async.util';
import { TrackedJobs } from '../../common/utils/concurrency/tracked-jobs.util';
import { RedisLockProvider } from '../../infra/redis/providers/redis-lock.provider';
import { MachineState } from '../../machine/enums/machine-state.enum';
import type { SandboxRuntimeIntent } from '../../machine/utils/proto/sandbox-runtime-intent.util';
import { OrganizationStorageCapService } from '../../organization/services/organization-storage-cap.service';
import { SettingsService } from '../../settings/services/settings.service';
import { BackupState } from '../../volume/enums/backup-state.enum';
import {
	MACHINE_UNAVAILABLE_GRACE_MINUTES,
	ORGANIZATION_ARCHIVE_INTERVAL_MINUTES,
	SANDBOX_WORKER_LIMITS,
} from '../constants/sandbox.constants';
import { SandboxEvents } from '../constants/sandbox-events.constants';
import { START_ORIGIN_DESIRED_STATES } from '../constants/sandbox-state-machine.constants';
import { Sandbox } from '../entities/sandbox.entity';
import { SandboxDesiredState } from '../enums/sandbox-desired-state.enum';
import { SandboxState } from '../enums/sandbox-state.enum';
import { SandboxArchivedEvent } from '../events/sandbox-archived.event';
import { SandboxDestroyedEvent } from '../events/sandbox-destroyed.event';
import { SandboxStoppedEvent } from '../events/sandbox-stopped.event';
import { SandboxRepository } from '../repositories/sandbox.repository';
import { SandboxStartWaitService } from '../services/lifecycle/sandbox-start-wait.service';
import { hydrateSandboxes } from '../utils/hydrate-sandboxes.util';
import { getStateChangeLockKey } from '../utils/lock-key.util';
import {
	DELETE_ON_STOP_INTERVAL_MINUTES,
	deletesImmediatelyOnStop,
} from '../utils/runtime/ephemeral.util';

const LIFECYCLE_WORKER_LOCK_TTL_SECONDS = 60;
const SANDBOX_LOCK_TTL_SECONDS = 30;

interface LifecyclePolicyChange {
	updateData: Partial<Sandbox>;
	runtimeIntent?: SandboxRuntimeIntent;
	publish?: (eventEmitter: EventEmitter2, updated: Sandbox) => void;
}

function publishStopped(eventEmitter: EventEmitter2, updated: Sandbox): void {
	eventEmitter.emit(SandboxEvents.STOPPED, new SandboxStoppedEvent(updated));
}

function stopOrDeletePolicy(sandbox: Sandbox): LifecyclePolicyChange {
	return deletesImmediatelyOnStop(sandbox)
		? deletePolicy(sandbox)
		: {
				updateData: {
					pending: true,
					desiredState: SandboxDesiredState.STOPPED,
				},
				publish: publishStopped,
			};
}

function fundsStopPolicy(sandbox: Sandbox): LifecyclePolicyChange {
	const policy = stopOrDeletePolicy(sandbox);
	return deletesImmediatelyOnStop(sandbox) ||
		sandbox.desiredState !== SandboxDesiredState.STARTED
		? policy
		: {
				...policy,
				updateData: { ...policy.updateData, fundsStoppedAt: new Date() },
			};
}

function machineUnavailablePolicy(): LifecyclePolicyChange {
	return { updateData: { state: SandboxState.MACHINE_UNAVAILABLE } };
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
		private readonly startWaits: SandboxStartWaitService,
		private readonly eventEmitter: EventEmitter2,
		private readonly storageCap: OrganizationStorageCapService
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
	@LogExecution('preemption-check')
	@CreateRequestContext()
	async preemptionCheck(): Promise<void> {
		await this.applyLifecyclePolicy(
			'preemption-check-worker-selected',
			`SELECT sandbox.id FROM sandbox
				WHERE sandbox."preemptedAt" IS NOT NULL AND sandbox.pending = false
					AND ((sandbox.state = ? AND sandbox."desiredState" = ?)
						OR (sandbox.state = ? AND sandbox."desiredState" = ?))
				ORDER BY sandbox."preemptedAt" ASC, sandbox.id ASC LIMIT ?`,
			[
				SandboxState.STARTED,
				SandboxDesiredState.STARTED,
				SandboxState.STOPPED,
				SandboxDesiredState.STOPPED,
				SANDBOX_WORKER_LIMITS.lifecycleBatchSize,
			],
			(sandbox) =>
				sandbox.state === SandboxState.STARTED
					? stopOrDeletePolicy(sandbox)
					: archivePolicy()
		);
	}

	@TrackJobExecution()
	@LogExecution('auto-archive-check')
	@CreateRequestContext()
	async autoArchiveCheck(): Promise<void> {
		const { archiveAfterStoppedDaysDefault } = await this.settings.get();
		const organizationsAtCap = await this.storageCap.organizationsAtCap();
		await this.applyLifecyclePolicy(
			'auto-archive-check-worker-selected',
			`SELECT sandbox.id FROM sandbox
			JOIN sandbox_last_activity activity ON activity."sandboxId" = sandbox.id
			LEFT JOIN organization_limits limits ON limits."organizationId" = sandbox."organizationId"
			WHERE sandbox.state = ? AND sandbox."desiredState" = ? AND sandbox.pending = false
				AND sandbox."organizationId" <> ALL(ARRAY[?]::uuid[])
				AND activity."lastActivityAt" < NOW() - INTERVAL '1 minute' * COALESCE(
					NULLIF(sandbox."autoArchiveInterval", ?),
					COALESCE(limits."archiveAfterStoppedDays", ?) * ?
				)
			ORDER BY sandbox."lastBackupAt" ASC, sandbox.id ASC LIMIT ?`,
			[
				SandboxState.STOPPED,
				SandboxDesiredState.STOPPED,
				organizationsAtCap,
				ORGANIZATION_ARCHIVE_INTERVAL_MINUTES,
				archiveAfterStoppedDaysDefault,
				MINUTES_PER_DAY,
				SANDBOX_WORKER_LIMITS.lifecycleBatchSize,
			],
			archivePolicy
		);
	}

	@TrackJobExecution()
	@LogExecution('offline-machine-archive-check')
	@CreateRequestContext()
	async offlineMachineArchiveCheck(): Promise<void> {
		const { archiveAfterMachineOfflineMinutes } = await this.settings.get();
		await this.applyLifecyclePolicy(
			'offline-machine-unavailable-check-worker-selected',
			`SELECT sandbox.id FROM sandbox
				JOIN machine ON machine.id = sandbox."machineId"
				WHERE sandbox.state = ? AND sandbox."desiredState" = ?
					AND sandbox.pending = false AND machine.state <> ?
					AND COALESCE(machine."lastHealthyAt", machine."createdAt")
						< NOW() - INTERVAL '1 minute' * ?
				ORDER BY sandbox.id ASC LIMIT ?`,
			[
				SandboxState.STARTED,
				SandboxDesiredState.STARTED,
				MachineState.READY,
				MACHINE_UNAVAILABLE_GRACE_MINUTES,
				SANDBOX_WORKER_LIMITS.lifecycleBatchSize,
			],
			machineUnavailablePolicy
		);
		await this.applyLifecyclePolicy(
			'offline-machine-ephemeral-delete-check-worker-selected',
			`SELECT sandbox.id FROM sandbox
				JOIN machine ON machine.id = sandbox."machineId"
				WHERE sandbox.state = ? AND sandbox.pending = false
					AND sandbox."autoDeleteInterval" = ?
					AND COALESCE(machine."lastHealthyAt", machine."createdAt")
						< NOW() - INTERVAL '1 minute' * ?
				ORDER BY sandbox.id ASC LIMIT ?`,
			[
				SandboxState.MACHINE_UNAVAILABLE,
				DELETE_ON_STOP_INTERVAL_MINUTES,
				archiveAfterMachineOfflineMinutes,
				SANDBOX_WORKER_LIMITS.lifecycleBatchSize,
			],
			deletePolicy
		);
		await this.applyLifecyclePolicy(
			'offline-machine-archive-check-worker-selected',
			`SELECT sandbox.id FROM sandbox
				JOIN machine ON machine.id = sandbox."machineId"
				WHERE sandbox.state = ? AND sandbox."desiredState" = ?
					AND sandbox.pending = false AND sandbox."backupState" = ?
					AND COALESCE(machine."lastHealthyAt", machine."createdAt")
						< NOW() - INTERVAL '1 minute' * ?
				ORDER BY sandbox.id ASC LIMIT ?`,
			[
				SandboxState.STOPPED,
				SandboxDesiredState.STOPPED,
				BackupState.COMPLETED,
				archiveAfterMachineOfflineMinutes,
				SANDBOX_WORKER_LIMITS.lifecycleBatchSize,
			],
			archivePolicy
		);
	}

	async stopAndArchiveOrganization(organizationId: string): Promise<void> {
		await this.withdrawStarts(organizationId);
		const rows = await this.entityManager.execute<{ id: string }[]>(
			`SELECT sandbox.id FROM sandbox
				WHERE sandbox."organizationId" = ? AND sandbox.pending = false
					AND sandbox.state = ANY(ARRAY[?]::sandbox_state_enum[])
					AND sandbox."desiredState" <> ?
				ORDER BY sandbox.id ASC`,
			[
				organizationId,
				[SandboxState.STARTED, SandboxState.STOPPED],
				SandboxDesiredState.DESTROYED,
			]
		);
		const sandboxes = await hydrateSandboxes(this.entityManager, rows);
		await mapSequentially(sandboxes, (sandbox) =>
			this.applyPolicyToSandbox(
				sandbox,
				sandbox.state === SandboxState.STARTED
					? fundsStopPolicy(sandbox)
					: archivePolicy()
			)
		);
	}

	async stopApiKeySandboxes(apiKeyId: string): Promise<number> {
		const rows = await this.entityManager.execute<{ id: string }[]>(
			`SELECT sandbox.id FROM sandbox
				WHERE sandbox."apiKeyId" = ? AND sandbox.pending = false
					AND sandbox.state = ? AND sandbox."desiredState" = ?
				ORDER BY sandbox.id ASC`,
			[apiKeyId, SandboxState.STARTED, SandboxDesiredState.STARTED]
		);
		const sandboxes = await hydrateSandboxes(this.entityManager, rows);
		await mapSequentially(sandboxes, (sandbox) =>
			this.applyPolicyToSandbox(sandbox, stopOrDeletePolicy(sandbox))
		);
		return sandboxes.length;
	}

	async deleteArchivedOfOrganization(organizationId: string): Promise<void> {
		const rows = await this.entityManager.execute<{ id: string }[]>(
			`SELECT sandbox.id FROM sandbox
				WHERE sandbox."organizationId" = ? AND sandbox.pending = false
					AND sandbox.state = ? AND sandbox."desiredState" <> ?
				ORDER BY sandbox.id ASC`,
			[organizationId, SandboxState.ARCHIVED, SandboxDesiredState.DESTROYED]
		);
		const sandboxes = await hydrateSandboxes(this.entityManager, rows);
		await mapSequentially(sandboxes, (sandbox) =>
			this.applyPolicyToSandbox(sandbox, deletePolicy(sandbox))
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
						AND NOT (sandbox."stopReason" IS NOT NULL AND sandbox."autoDeleteInterval" = ?)
						AND activity."lastActivityAt" < NOW() - INTERVAL '1 minute' * sandbox."autoDeleteInterval"
					ORDER BY activity."lastActivityAt" ASC, sandbox.id ASC LIMIT ?`,
			[
				MachineState.READY,
				SandboxState.STOPPED,
				SandboxDesiredState.STOPPED,
				DELETE_ON_STOP_INTERVAL_MINUTES,
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

	private async withdrawStarts(organizationId: string): Promise<void> {
		const rows = await this.entityManager.execute<{ id: string }[]>(
			`SELECT sandbox.id FROM sandbox
				WHERE sandbox."organizationId" = ? AND sandbox.pending = true
					AND sandbox."desiredState" = ?
					AND sandbox.state = ANY(ARRAY[?]::sandbox_state_enum[])
				ORDER BY sandbox.id ASC`,
			[
				organizationId,
				SandboxDesiredState.STARTED,
				[...START_ORIGIN_DESIRED_STATES.keys()],
			]
		);
		const sandboxes = await hydrateSandboxes(this.entityManager, rows);
		await mapSequentially(sandboxes, (sandbox) =>
			this.startWaits.withdraw(sandbox)
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
						runtimeIntent: policy.runtimeIntent,
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
		if (updated) policy.publish?.(this.eventEmitter, updated);
	}
}
