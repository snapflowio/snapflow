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
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { LogExecution } from '../../../common/decorators/log-execution.decorator';
import { TrackJobExecution } from '../../../common/decorators/track-job-execution.decorator';
import { settleSequentially } from '../../../common/utils/concurrency/sequential-async.util';
import { TrackedJobs } from '../../../common/utils/concurrency/tracked-jobs.util';
import { RedisLockProvider } from '../../../infra/redis/providers/redis-lock.provider';
import {
	BACKUP_MAX_WORKER_ERRORS,
	BACKUP_PROGRESS_CURSOR_KEY,
	BACKUP_WORKER_ERROR_WINDOW_SECONDS,
	BACKUP_WORKER_LOCK_TTL_SECONDS,
	BackupJobName,
	SANDBOX_BACKUP_LOCK_TTL_SECONDS,
	SANDBOX_STOP_BACKUP_LOCK_TTL_SECONDS,
	sandboxBackupLockKey,
} from '../../constants/backup.constants';
import { SANDBOX_WORKER_LIMITS } from '../../constants/sandbox.constants';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxDesiredState } from '../../enums/sandbox-desired-state.enum';
import { SandboxMode } from '../../enums/sandbox-mode.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { MachineState } from '../../machine/enums/machine-state.enum';
import { SandboxBackupExecutionService } from '../../services/backup/sandbox-backup-execution.service';
import { SandboxBackupRequestService } from '../../services/backup/sandbox-backup-request.service';
import { SandboxBackupStateService } from '../../services/backup/sandbox-backup-state.service';
import { hydrateSandboxes } from '../../utils/hydrate-sandboxes.util';
import { BackupState } from '../../volume/enums/backup-state.enum';

const PENDING_ONLY: ReadonlySet<BackupState> = new Set([BackupState.PENDING]);
const IN_PROGRESS_ONLY: ReadonlySet<BackupState> = new Set([
	BackupState.IN_PROGRESS,
]);
const PENDING_OR_IN_PROGRESS: ReadonlySet<BackupState> = new Set([
	BackupState.PENDING,
	BackupState.IN_PROGRESS,
]);
const BACKUP_WORKER_STATES = [
	SandboxState.ARCHIVING,
	SandboxState.STARTED,
	SandboxState.STOPPED,
];
const STOPPED_STATES = [SandboxState.ARCHIVING, SandboxState.STOPPED];
const ERRORED_DRAINING_CONTEXT = 'errored sandbox on draining machine';
const SANDBOX_CONTEXT = 'sandbox';

type IdRow = { id: string };

@Injectable()
export class BackupManager extends TrackedJobs {
	protected readonly logger = new Logger(BackupManager.name);

	constructor(
		private readonly entityManager: EntityManager,
		@InjectRedis() private readonly redis: Redis,
		private readonly redisLockProvider: RedisLockProvider,
		private readonly backupRequests: SandboxBackupRequestService,
		private readonly backupExecution: SandboxBackupExecutionService,
		private readonly backupState: SandboxBackupStateService
	) {
		super();
	}

	get em(): EntityManager {
		return this.entityManager;
	}

	@TrackJobExecution()
	@LogExecution(BackupJobName.CHECK_PENDING)
	@CreateRequestContext()
	async checkBackupStates(): Promise<void> {
		await this.runWorker(BackupJobName.CHECK_PENDING, async () => {
			const rows = await this.entityManager.execute<IdRow[]>(
				`SELECT DISTINCT ON (sandbox."machineId") sandbox.id
				FROM sandbox JOIN machine ON machine.id = sandbox."machineId"
				WHERE sandbox.state = ANY(ARRAY[?]::sandbox_state_enum[]) AND sandbox."backupState" = ?
					AND sandbox."desiredState" <> ? AND machine.state = ?
				ORDER BY sandbox."machineId",
					CASE sandbox.state WHEN ? THEN 1 WHEN ? THEN 2 WHEN ? THEN 3 ELSE 999 END,
					sandbox."lastBackupAt" ASC NULLS FIRST
				LIMIT ?`,
				[
					BACKUP_WORKER_STATES,
					BackupState.PENDING,
					SandboxDesiredState.DESTROYED,
					MachineState.READY,
					SandboxState.ARCHIVING,
					SandboxState.STOPPED,
					SandboxState.STARTED,
					SANDBOX_WORKER_LIMITS.backupPendingBatchSize,
				]
			);
			await this.advanceBackups(rows, PENDING_ONLY, SANDBOX_CONTEXT);
		});
	}

	@TrackJobExecution()
	@LogExecution(BackupJobName.CHECK_IN_PROGRESS)
	@CreateRequestContext()
	async checkBackupStatesInProgress(): Promise<void> {
		await this.runWorker(BackupJobName.CHECK_IN_PROGRESS, async () => {
			const cursor = await this.redis.get(BACKUP_PROGRESS_CURSOR_KEY);
			const rows = await this.entityManager.execute<IdRow[]>(
				`SELECT sandbox.id FROM sandbox
				JOIN machine ON machine.id = sandbox."machineId"
				WHERE sandbox.state = ANY(ARRAY[?]::sandbox_state_enum[]) AND sandbox."backupState" = ?
					AND sandbox."desiredState" <> ? AND machine.state = ?
					AND (?::varchar IS NULL OR sandbox.id > ?)
				ORDER BY sandbox.id ASC LIMIT ?`,
				[
					BACKUP_WORKER_STATES,
					BackupState.IN_PROGRESS,
					SandboxDesiredState.DESTROYED,
					MachineState.READY,
					cursor,
					cursor,
					SANDBOX_WORKER_LIMITS.backupInProgressBatchSize,
				]
			);
			const nextCursor = rows.at(-1)?.id;
			if (nextCursor) {
				await this.redis.set(BACKUP_PROGRESS_CURSOR_KEY, nextCursor);
			} else {
				await this.redis.del(BACKUP_PROGRESS_CURSOR_KEY);
			}
			await this.advanceBackups(rows, IN_PROGRESS_ONLY, SANDBOX_CONTEXT);
		});
	}

	@TrackJobExecution()
	@LogExecution(BackupJobName.CHECK_ERRORED_DRAINING)
	@CreateRequestContext()
	async checkBackupStatesForErroredDraining(): Promise<void> {
		await this.runWorker(BackupJobName.CHECK_ERRORED_DRAINING, async () => {
			const rows = await this.entityManager.execute<IdRow[]>(
				`SELECT sandbox.id FROM sandbox
				JOIN machine ON machine.id = sandbox."machineId"
				WHERE sandbox.state = ? AND sandbox."backupState" = ANY(ARRAY[?]::sandbox_backupstate_enum[])
					AND machine.state = ? AND machine.draining = true
				ORDER BY sandbox."lastBackupAt" ASC NULLS FIRST, sandbox."createdAt" ASC
				LIMIT ?`,
				[
					SandboxState.ERROR,
					[...PENDING_OR_IN_PROGRESS],
					MachineState.READY,
					SANDBOX_WORKER_LIMITS.erroredDrainingBackupBatchSize,
				]
			);
			await this.advanceBackups(
				rows,
				PENDING_OR_IN_PROGRESS,
				ERRORED_DRAINING_CONTEXT
			);
		});
	}

	@TrackJobExecution()
	@LogExecution(BackupJobName.SYNC_STOP_STATE)
	@CreateRequestContext()
	async syncStopStateCreateBackups(): Promise<void> {
		await this.runWorker(BackupJobName.SYNC_STOP_STATE, async () => {
			const rows = await this.entityManager.execute<IdRow[]>(
				`SELECT sandbox.id FROM sandbox
				JOIN machine ON machine.id = sandbox."machineId"
				WHERE sandbox.state = ANY(ARRAY[?]::sandbox_state_enum[]) AND sandbox.mode = ?
					AND sandbox."backupState" = ? AND sandbox."desiredState" <> ?
					AND machine.state = ? LIMIT ?`,
				[
					STOPPED_STATES,
					SandboxMode.STANDARD,
					BackupState.NONE,
					SandboxDesiredState.DESTROYED,
					MachineState.READY,
					SANDBOX_WORKER_LIMITS.stopStateBackupBatchSize,
				]
			);
			const sandboxes = await hydrateSandboxes(this.entityManager, rows);
			await settleSequentially(sandboxes, (sandbox) =>
				this.redisLockProvider.runExclusive(
					sandboxBackupLockKey(sandbox.id),
					SANDBOX_STOP_BACKUP_LOCK_TTL_SECONDS,
					() => this.queueStopBackup(sandbox)
				)
			);
		});
	}

	private async queueStopBackup(sandbox: Sandbox): Promise<void> {
		try {
			await this.backupRequests.setBackupPending(sandbox);
		} catch (error) {
			this.logger.error(
				`Error processing backup for sandbox ${sandbox.id}:`,
				error
			);
		}
	}

	private async runWorker(
		jobName: string,
		tick: () => Promise<void>
	): Promise<void> {
		await this.redisLockProvider.runExclusive(
			jobName,
			BACKUP_WORKER_LOCK_TTL_SECONDS,
			async () => {
				try {
					await tick();
				} catch (error) {
					this.logger.error(`Error processing backups (${jobName}):`, error);
				}
			}
		);
	}

	private async advanceBackups(
		rows: readonly IdRow[],
		handledStates: ReadonlySet<BackupState>,
		context: string
	): Promise<void> {
		const sandboxes = await hydrateSandboxes(this.entityManager, rows);
		await settleSequentially(sandboxes, (candidate) =>
			this.redisLockProvider.runExclusive(
				sandboxBackupLockKey(candidate.id),
				SANDBOX_BACKUP_LOCK_TTL_SECONDS,
				() => this.advanceBackup(candidate.id, handledStates, context)
			)
		);
	}

	private async advanceBackup(
		sandboxId: string,
		handledStates: ReadonlySet<BackupState>,
		context: string
	): Promise<void> {
		try {
			const sandbox = await this.entityManager.findOneOrFail(
				Sandbox,
				{ id: sandboxId },
				{ refresh: true }
			);
			try {
				await this.backupExecution.advance(sandbox, handledStates);
			} catch (error) {
				await this.recordWorkerError(sandbox, error, context);
			}
		} catch (error) {
			this.logger.error(
				`Error processing backup for ${context} ${sandboxId}:`,
				error
			);
		}
	}

	private async recordWorkerError(
		sandbox: Sandbox,
		error: unknown,
		context: string
	): Promise<void> {
		const counterKey = `${sandboxBackupLockKey(sandbox.id)}-error-retry`;
		const errorCount = await this.redis.incr(counterKey);
		await this.redis.expire(counterKey, BACKUP_WORKER_ERROR_WINDOW_SECONDS);
		if (errorCount <= BACKUP_MAX_WORKER_ERRORS) return;

		this.logger.error(
			`Error processing backup for ${context} ${sandbox.id}:`,
			error
		);
		await this.backupState.recordFailure(sandbox, error);
	}
}
