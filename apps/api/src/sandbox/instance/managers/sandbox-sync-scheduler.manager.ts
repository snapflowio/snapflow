/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type FilterQuery, QueryOrder } from '@mikro-orm/core';
import { CreateRequestContext } from '@mikro-orm/decorators/legacy';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { SECONDS_PER_MINUTE } from '../../../common/constants/time.constants';
import { LogExecution } from '../../../common/decorators/log-execution.decorator';
import { TrackJobExecution } from '../../../common/decorators/track-job-execution.decorator';
import {
	mapSequentially,
	settleSequentially,
} from '../../../common/utils/concurrency/sequential-async.util';
import { TrackedJobs } from '../../../common/utils/concurrency/tracked-jobs.util';
import { RedisLockProvider } from '../../../infra/redis/providers/redis-lock.provider';
import { MachineState } from '../../machine/enums/machine-state.enum';
import { MachineService } from '../../machine/services/machine.service';
import { BackupState } from '../../volume/enums/backup-state.enum';
import { SANDBOX_WORKER_LIMITS } from '../constants/sandbox.constants';
import { Sandbox } from '../entities/sandbox.entity';
import { SandboxDesiredState } from '../enums/sandbox-desired-state.enum';
import { SandboxState } from '../enums/sandbox-state.enum';
import { getStateChangeLockKey } from '../utils/lock-key.util';
import { SandboxManager } from './sandbox.manager';

const STATE_SYNC_MACHINE_CURSOR_KEY = 'sync-states-machine-cursor';
const RESTORING_STATE_SYNC_MACHINE_CURSOR_KEY =
	'sync-restoring-states-machine-cursor';
const STATE_SYNC_MACHINE_LOCK_TTL_MINUTES = 5;
const STATE_SYNC_MACHINE_LOCK_TTL_SECONDS =
	STATE_SYNC_MACHINE_LOCK_TTL_MINUTES * SECONDS_PER_MINUTE;
const RESTORING_SYNC_MACHINE_LOCK_TTL_SECONDS = 60;
const ARCHIVED_SYNC_LOCK_TTL_SECONDS = 30;
const ARCHIVED_DESIRED_SYNC_LOCK_KEY = 'sync-archived-desired-states';
const ARCHIVED_COMPLETED_SYNC_LOCK_KEY = 'sync-archived-completed-states';
const UNAVAILABLE_MACHINE_MIGRATION_SWEEP_LOCK_KEY =
	'sweep-migrations-on-unavailable-machines';
const UNAVAILABLE_MACHINE_MIGRATION_SWEEP_LOCK_TTL_SECONDS = 60;
const UNASSIGNED_MACHINE_LOCK_SUFFIX = 'unassigned';
const ARCHIVABLE_STATES = [
	SandboxState.ARCHIVING,
	SandboxState.STOPPED,
	SandboxState.ERROR,
];

@Injectable()
export class SandboxSyncScheduler extends TrackedJobs {
	protected readonly logger = new Logger(SandboxSyncScheduler.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly machineService: MachineService,
		private readonly redisLockProvider: RedisLockProvider,
		private readonly sandboxManager: SandboxManager,
		@InjectRedis() private readonly redis: Redis
	) {
		super();
	}

	get em(): EntityManager {
		return this.entityManager;
	}

	@TrackJobExecution()
	@LogExecution('sync-states-per-machine-locked')
	@CreateRequestContext()
	async syncStates(): Promise<void> {
		const machineIds: (string | null)[] = [
			null,
			...(await this.readyMachineIdsPage(STATE_SYNC_MACHINE_CURSOR_KEY)),
		];

		await mapSequentially(machineIds, (machineId) =>
			this.syncMachineSandboxes(
				`sync-states:${machineId ?? UNASSIGNED_MACHINE_LOCK_SUFFIX}`,
				STATE_SYNC_MACHINE_LOCK_TTL_SECONDS,
				{ machineId, state: { $ne: SandboxState.RESTORING }, pending: true },
				machineId === null
					? SANDBOX_WORKER_LIMITS.unassignedStateSyncBatchSize
					: SANDBOX_WORKER_LIMITS.stateSyncPerMachineBatchSize
			)
		);
	}

	@TrackJobExecution()
	@LogExecution('sync-restoring-states')
	@CreateRequestContext()
	async syncRestoringStates(): Promise<void> {
		const machineIds = await this.readyMachineIdsPage(
			RESTORING_STATE_SYNC_MACHINE_CURSOR_KEY
		);

		await mapSequentially(machineIds, (machineId) =>
			this.syncMachineSandboxes(
				`sync-restoring-states:${machineId}`,
				RESTORING_SYNC_MACHINE_LOCK_TTL_SECONDS,
				{ machineId, state: SandboxState.RESTORING, pending: true },
				SANDBOX_WORKER_LIMITS.stateSyncPerMachineBatchSize
			)
		);
	}

	@TrackJobExecution()
	@LogExecution('sweep-migrations-on-unavailable-machines')
	@CreateRequestContext()
	async sweepMigrationsOnUnavailableMachines(): Promise<void> {
		await this.redisLockProvider.runExclusive(
			UNAVAILABLE_MACHINE_MIGRATION_SWEEP_LOCK_KEY,
			UNAVAILABLE_MACHINE_MIGRATION_SWEEP_LOCK_TTL_SECONDS,
			async () => {
				const rows = await this.entityManager.execute<{ id: string }[]>(
					`SELECT sandbox.id FROM sandbox
					JOIN machine ON machine.id = sandbox."machineId" AND machine.state <> ?
					WHERE sandbox.state = ? AND sandbox."desiredState" = ? AND sandbox.pending = true
					ORDER BY sandbox."updatedAt" ASC, sandbox.id ASC LIMIT ?`,
					[
						MachineState.READY,
						SandboxState.RESTORING,
						SandboxDesiredState.STOPPED,
						SANDBOX_WORKER_LIMITS.stateSyncPerMachineBatchSize,
					]
				);
				await this.syncUnlocked(rows);
			}
		);
	}

	@TrackJobExecution()
	@LogExecution('sync-archived-desired-states')
	@CreateRequestContext()
	async syncArchivedDesiredStates(): Promise<void> {
		await this.syncArchived(
			ARCHIVED_DESIRED_SYNC_LOCK_KEY,
			{
				state: { $in: ARCHIVABLE_STATES },
				desiredState: SandboxDesiredState.ARCHIVED,
			},
			SANDBOX_WORKER_LIMITS.lifecycleBatchSize
		);
	}

	@TrackJobExecution()
	@LogExecution('sync-archived-completed-states')
	@CreateRequestContext()
	async syncArchivedCompletedStates(): Promise<void> {
		await this.syncArchived(
			ARCHIVED_COMPLETED_SYNC_LOCK_KEY,
			{
				state: { $in: ARCHIVABLE_STATES },
				desiredState: SandboxDesiredState.ARCHIVED,
				backupState: BackupState.COMPLETED,
			},
			SANDBOX_WORKER_LIMITS.archivedCompletionBatchSize
		);
	}

	private async readyMachineIdsPage(cursorKey: string): Promise<string[]> {
		const cursor = await this.redis.get(cursorKey);
		let machineIds = await this.machineService.findReadyIdsPage(
			cursor,
			SANDBOX_WORKER_LIMITS.readyMachineBatchSize
		);
		if (machineIds.length === 0 && cursor) {
			machineIds = await this.machineService.findReadyIdsPage(
				null,
				SANDBOX_WORKER_LIMITS.readyMachineBatchSize
			);
		}
		const nextCursor = machineIds.at(-1);
		if (nextCursor) await this.redis.set(cursorKey, nextCursor);
		else await this.redis.del(cursorKey);
		return machineIds;
	}

	private async syncMachineSandboxes(
		machineLockKey: string,
		lockTtlSeconds: number,
		where: FilterQuery<Sandbox>,
		limit: number
	): Promise<void> {
		await this.redisLockProvider.runExclusive(
			machineLockKey,
			lockTtlSeconds,
			async () => {
				const sandboxes = await this.entityManager.find(Sandbox, where, {
					fields: ['id'],
					orderBy: { updatedAt: QueryOrder.ASC, id: QueryOrder.ASC },
					limit,
				});
				await this.syncUnlocked(sandboxes);
			}
		);
	}

	private async syncUnlocked(
		sandboxes: readonly { id: string }[]
	): Promise<void> {
		for (const { id } of sandboxes) {
			if (await this.redisLockProvider.isLocked(getStateChangeLockKey(id))) {
				continue;
			}
			await this.sandboxManager.syncInstanceState(id);
		}
	}

	private async syncArchived(
		lockKey: string,
		where: FilterQuery<Sandbox>,
		limit: number
	): Promise<void> {
		await this.redisLockProvider.runExclusive(
			lockKey,
			ARCHIVED_SYNC_LOCK_TTL_SECONDS,
			async () => {
				const sandboxes = await this.entityManager.find(Sandbox, where, {
					limit,
					orderBy: { updatedAt: QueryOrder.ASC, id: QueryOrder.ASC },
				});

				await settleSequentially(sandboxes, async (sandbox) => {
					await this.sandboxManager.syncInstanceState(sandbox.id);
				});
			}
		);
	}
}
