/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { QueryOrder } from '@mikro-orm/core';
import { CreateRequestContext } from '@mikro-orm/decorators/legacy';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { MILLISECONDS_PER_HOUR } from '../../../../common/constants/time.constants';
import { LogExecution } from '../../../../common/decorators/log-execution.decorator';
import { TrackJobExecution } from '../../../../common/decorators/track-job-execution.decorator';
import { settleSequentially } from '../../../../common/utils/concurrency/sequential-async.util';
import { TrackedJobs } from '../../../../common/utils/concurrency/tracked-jobs.util';
import { addMilliseconds } from '../../../../common/utils/time.util';
import { RedisLockProvider } from '../../../../infra/redis/providers/redis-lock.provider';
import { BackupState } from '../../../volume/enums/backup-state.enum';
import {
	BACKUP_MAINTENANCE_LOCK_TTL_SECONDS,
	BACKUP_POLICY,
	BACKUP_RETRY_CURSOR_KEY,
	BACKUP_RETRY_ERROR_SUBSTRINGS,
	BACKUP_STALE_ERROR_MESSAGE,
	BACKUP_STALE_TIMEOUT_MS,
	BackupJobName,
	SANDBOX_BACKUP_LOCK_TTL_SECONDS,
	sandboxBackupLockKey,
} from '../../constants/backup.constants';
import { SANDBOX_WORKER_LIMITS } from '../../constants/sandbox.constants';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxDesiredState } from '../../enums/sandbox-desired-state.enum';
import { SandboxBackupStateService } from '../../services/backup/sandbox-backup-state.service';
import { hydrateSandboxes } from '../../utils/hydrate-sandboxes.util';

@Injectable()
export class BackupMaintenanceManager extends TrackedJobs {
	protected readonly logger = new Logger(BackupMaintenanceManager.name);

	constructor(
		private readonly entityManager: EntityManager,
		@InjectRedis() private readonly redis: Redis,
		private readonly redisLockProvider: RedisLockProvider,
		private readonly backupState: SandboxBackupStateService
	) {
		super();
	}

	get em(): EntityManager {
		return this.entityManager;
	}

	@TrackJobExecution()
	@LogExecution(BackupJobName.CHECK_STALE)
	@CreateRequestContext()
	async checkStaleInProgressBackups(): Promise<void> {
		await this.redisLockProvider.runExclusive(
			BackupJobName.CHECK_STALE,
			BACKUP_MAINTENANCE_LOCK_TTL_SECONDS,
			async () => {
				try {
					await this.markStaleBackupsErrored();
				} catch (error) {
					this.logger.error(
						'Error checking for stale in-progress backups:',
						error
					);
				}
			}
		);
	}

	@TrackJobExecution()
	@LogExecution(BackupJobName.RETRY_ERRORED)
	@CreateRequestContext()
	async retryErroredBackups(): Promise<void> {
		const { retryIntervalHours } = BACKUP_POLICY;
		await this.redisLockProvider.runExclusive(
			BackupJobName.RETRY_ERRORED,
			BACKUP_MAINTENANCE_LOCK_TTL_SECONDS,
			async () => {
				try {
					await this.resetRetryableBackups(
						addMilliseconds(
							new Date(),
							-retryIntervalHours * MILLISECONDS_PER_HOUR
						)
					);
				} catch (error) {
					this.logger.error('Error retrying errored backups:', error);
				}
			}
		);
	}

	private async markStaleBackupsErrored(): Promise<void> {
		const timeoutCutoff = addMilliseconds(new Date(), -BACKUP_STALE_TIMEOUT_MS);
		const staleFilter = {
			backupState: BackupState.IN_PROGRESS,
			desiredState: { $ne: SandboxDesiredState.DESTROYED },
			updatedAt: { $lt: timeoutCutoff },
		};
		const staleSandboxes = await this.entityManager.find(Sandbox, staleFilter, {
			fields: ['id'],
			orderBy: { updatedAt: QueryOrder.ASC, id: QueryOrder.ASC },
			limit: SANDBOX_WORKER_LIMITS.lifecycleBatchSize,
		});
		if (staleSandboxes.length === 0) return;

		const affected = await this.entityManager.nativeUpdate(
			Sandbox,
			{ id: { $in: staleSandboxes.map(({ id }) => id) }, ...staleFilter },
			{
				backupState: BackupState.ERROR,
				backupErrorReason: BACKUP_STALE_ERROR_MESSAGE,
				updatedAt: new Date(),
			}
		);
		this.logger.warn(
			`Marked ${affected} stale in-progress backups as errored: ${BACKUP_STALE_ERROR_MESSAGE}`
		);
	}

	private async resetRetryableBackups(cutoff: Date): Promise<void> {
		const cursor = await this.redis.get(BACKUP_RETRY_CURSOR_KEY);
		const rows = await this.entityManager.execute<{ id: string }[]>(
			`SELECT id FROM sandbox
			WHERE "backupState" = ? AND "desiredState" <> ? AND "updatedAt" < ?
				AND "backupErrorReason" ILIKE ANY(ARRAY[?]::text[])
				AND (?::varchar IS NULL OR id > ?)
			ORDER BY id ASC LIMIT ?`,
			[
				BackupState.ERROR,
				SandboxDesiredState.DESTROYED,
				cutoff,
				BACKUP_RETRY_ERROR_SUBSTRINGS.map((substring) => `%${substring}%`),
				cursor,
				cursor,
				SANDBOX_WORKER_LIMITS.backupRetryBatchSize,
			]
		);
		const nextCursor = rows.at(-1)?.id;
		if (nextCursor) await this.redis.set(BACKUP_RETRY_CURSOR_KEY, nextCursor);
		else await this.redis.del(BACKUP_RETRY_CURSOR_KEY);
		const sandboxes = await hydrateSandboxes(this.entityManager, rows);

		const results = await settleSequentially(sandboxes, (sandbox) =>
			this.redisLockProvider.runExclusive(
				sandboxBackupLockKey(sandbox.id),
				SANDBOX_BACKUP_LOCK_TTL_SECONDS,
				() => this.resetIfStillErrored(sandbox.id)
			)
		);

		results.forEach((result, index) => {
			if (result.status === 'rejected') {
				this.logger.error(
					`Failed to reset backup state for sandbox ${sandboxes[index].id}:`,
					result.reason
				);
			}
		});
	}

	private async resetIfStillErrored(sandboxId: string): Promise<void> {
		const sandbox = await this.entityManager.findOneOrFail(
			Sandbox,
			{ id: sandboxId },
			{ refresh: true }
		);
		if (sandbox.backupState !== BackupState.ERROR) {
			return;
		}

		this.logger.log(
			`Retrying backup for sandbox ${sandbox.id} (error: ${sandbox.backupErrorReason})`
		);
		await this.backupState.update(sandbox.id, BackupState.NONE);
	}
}
