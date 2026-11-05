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
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { SECONDS_PER_HOUR } from '../../../common/constants/time.constants';
import { settleSequentially } from '../../../common/utils/concurrency/sequential-async.util';
import { errorMessage } from '../../../common/utils/error/error.util';
import { RedisLockProvider } from '../../../infra/redis/providers/redis-lock.provider';
import { OrganizationUsageService } from '../../../organization/services/organization-usage.service';
import { DRAINING_MIGRATION_LOCK_TTL_SECONDS } from '../../constants/draining-machine.constants';
import { SANDBOX_WORKER_LIMITS } from '../../constants/sandbox.constants';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxDesiredState } from '../../enums/sandbox-desired-state.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';
import type { Machine } from '../../machine/entities/machine.entity';
import { inPlaceRecoveryIntent } from '../../machine/utils/proto/sandbox-runtime-intent.util';
import { SandboxRepository } from '../../repositories/sandbox.repository';
import { getStateChangeLockKey } from '../../utils/lock-key.util';
import { BackupState } from '../../volume/enums/backup-state.enum';
import { SandboxBackupRequestService } from '../backup/sandbox-backup-request.service';

const RETRY_COOLDOWN_HOURS = 12;
const RETRY_COOLDOWN_SECONDS = RETRY_COOLDOWN_HOURS * SECONDS_PER_HOUR;
const COOLDOWN_MARKER = '1';

function backupRetryKey(sandboxId: string): string {
	return `draining:backup-retry:${sandboxId}`;
}

function recoverKey(sandboxId: string): string {
	return `draining:recover:${sandboxId}`;
}

@Injectable()
export class DrainingMachineRecoveryService {
	private readonly logger = new Logger(DrainingMachineRecoveryService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly sandboxRepository: SandboxRepository,
		private readonly redisLockProvider: RedisLockProvider,
		private readonly organizationUsageService: OrganizationUsageService,
		private readonly backupRequests: SandboxBackupRequestService,
		@InjectRedis() private readonly redis: Redis
	) {}

	async retryErroredBackups(machineId: string): Promise<void> {
		const sandboxes = await this.entityManager.find(
			Sandbox,
			[
				{
					machineId,
					state: SandboxState.STOPPED,
					recoverable: false,
					desiredState: SandboxDesiredState.STOPPED,
					backupState: BackupState.ERROR,
				},
				{
					machineId,
					state: SandboxState.ERROR,
					recoverable: false,
					backupState: { $in: [BackupState.ERROR, BackupState.NONE] },
					desiredState: { $ne: SandboxDesiredState.DESTROYED },
				},
			],
			{ limit: SANDBOX_WORKER_LIMITS.drainingSandboxBatchSize }
		);

		await settleSequentially(sandboxes, async (sandbox) => {
			const retryKey = backupRetryKey(sandbox.id);
			if (await this.redis.exists(retryKey)) {
				return;
			}
			try {
				await this.backupRequests.setBackupPending(sandbox);
				await this.redis.set(
					retryKey,
					COOLDOWN_MARKER,
					'EX',
					RETRY_COOLDOWN_SECONDS
				);
				this.logger.log(
					`Retried backup for sandbox ${sandbox.id} on draining machine ${machineId}`
				);
			} catch (error) {
				this.logger.error(
					`Failed to retry backup for sandbox ${sandbox.id} on draining machine ${machineId}`,
					error
				);
			}
		});
	}

	async recoverRecoverableSandboxes(machine: Machine): Promise<void> {
		const sandboxes = await this.entityManager.find(
			Sandbox,
			{
				machineId: machine.id,
				recoverable: true,
				state: SandboxState.ERROR,
				pending: false,
				desiredState: { $ne: SandboxDesiredState.DESTROYED },
				backupSnapshot: { $ne: null },
			},
			{ limit: SANDBOX_WORKER_LIMITS.drainingSandboxBatchSize }
		);
		if (sandboxes.length === 0) {
			return;
		}

		await settleSequentially(sandboxes, async (sandbox) => {
			const cooldownKey = recoverKey(sandbox.id);
			if (await this.redis.exists(cooldownKey)) {
				return;
			}
			await this.redisLockProvider.runExclusive(
				getStateChangeLockKey(sandbox.id),
				DRAINING_MIGRATION_LOCK_TTL_SECONDS,
				async () => {
					await this.recoverInPlace(sandbox, machine.id);
					await this.redis.set(
						cooldownKey,
						COOLDOWN_MARKER,
						'EX',
						RETRY_COOLDOWN_SECONDS
					);
				}
			);
		});
	}

	private async recoverInPlace(
		sandbox: Sandbox,
		machineId: string
	): Promise<void> {
		let diskIncremented = false;
		try {
			const reservation =
				await this.organizationUsageService.incrementPendingSandboxUsage(
					sandbox.organizationId,
					sandbox.sandboxClass,
					0,
					0,
					sandbox.disk,
					0,
					sandbox.id
				);
			diskIncremented = reservation.diskIncremented;

			await this.sandboxRepository.updateWhere(sandbox.id, {
				updateData: { desiredState: SandboxDesiredState.STOPPED },
				whereCondition: { state: SandboxState.ERROR, machineId },
				runtimeIntent: inPlaceRecoveryIntent(sandbox),
			});
			this.logger.log(
				`Recovering sandbox ${sandbox.id} on draining machine ${machineId}`
			);
		} catch (error) {
			this.logger.error(
				`Failed to recover sandbox ${sandbox.id} on draining machine ${machineId}`,
				error
			);
			if (diskIncremented) {
				await this.organizationUsageService
					.decrementPendingSandboxUsage(
						sandbox.organizationId,
						sandbox.sandboxClass,
						undefined,
						undefined,
						sandbox.disk
					)
					.catch((rollbackError: unknown) =>
						this.logger.error(
							`Failed to release reserved disk for sandbox ${sandbox.id}: ${errorMessage(rollbackError)}`
						)
					);
			}
		}
	}
}
