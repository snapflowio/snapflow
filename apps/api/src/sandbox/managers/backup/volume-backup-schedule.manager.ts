/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { QueryOrder, TransactionPropagation } from '@mikro-orm/core';
import { CreateRequestContext } from '@mikro-orm/decorators/legacy';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { MILLISECONDS_PER_SECOND } from '../../../common/constants/time.constants';
import { LogExecution } from '../../../common/decorators/log-execution.decorator';
import { TrackJobExecution } from '../../../common/decorators/track-job-execution.decorator';
import { settleSequentially } from '../../../common/utils/concurrency/sequential-async.util';
import { TrackedJobs } from '../../../common/utils/concurrency/tracked-jobs.util';
import { errorMessage } from '../../../common/utils/error/error.util';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { RedisLockProvider } from '../../../infra/redis/providers/redis-lock.provider';
import { Machine } from '../../../machine/entities/machine.entity';
import { MachineState } from '../../../machine/enums/machine-state.enum';
import { Job } from '../../../machine-job/entities/job.entity';
import { BACKUP_JOB_TYPES } from '../../../machine-job/enums/job-type.enum';
import { ResourceType } from '../../../machine-job/enums/resource-type.enum';
import { MachineJobDispatchService } from '../../../machine-job/services/machine-job-dispatch.service';
import {
	VOLUME_BACKUP_SCHEDULE,
	VolumeBackupJobName,
} from '../../../volume/constants/volume-backup.constants';
import { Volume } from '../../../volume/entities/volume.entity';
import { VolumeBackupState } from '../../../volume/enums/volume-backup-state.enum';
import { VolumeState } from '../../../volume/enums/volume-state.enum';
import { VolumeBackupService } from '../../../volume/services/volume-backup.service';
import {
	SANDBOX_BACKUP_LOCK_TTL_SECONDS,
	sandboxBackupLockKey,
} from '../../constants/backup.constants';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxState } from '../../enums/sandbox-state.enum';
import {
	type DueVolumeBackup,
	selectDueVolumeBackups,
} from '../../utils/volume-backup-schedule.util';

/** Backs up the volumes of running sandboxes so a lost host loses at most one interval. */
@Injectable()
export class VolumeBackupScheduleManager extends TrackedJobs {
	protected readonly logger = new Logger(VolumeBackupScheduleManager.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly configService: TypedConfigService,
		private readonly redisLockProvider: RedisLockProvider,
		private readonly volumeBackupService: VolumeBackupService,
		private readonly machineJobDispatch: MachineJobDispatchService
	) {
		super();
	}

	get em(): EntityManager {
		return this.entityManager;
	}

	@TrackJobExecution()
	@LogExecution(VolumeBackupJobName.SCHEDULE_RUNNING)
	@CreateRequestContext()
	async scheduleRunningVolumeBackups(): Promise<void> {
		await this.redisLockProvider.runExclusive(
			VolumeBackupJobName.SCHEDULE_RUNNING,
			VOLUME_BACKUP_SCHEDULE.LOCK_TTL_SECONDS,
			async () => {
				const due = await this.findDueBackups();
				await settleSequentially(due, (backup) =>
					this.redisLockProvider.runExclusive(
						sandboxBackupLockKey(backup.sandboxId),
						SANDBOX_BACKUP_LOCK_TTL_SECONDS,
						() => this.dispatch(backup)
					)
				);
			}
		);
	}

	private async findDueBackups(): Promise<DueVolumeBackup[]> {
		const intervalMilliseconds =
			this.configService.getOrThrow('volumeBackup.intervalSeconds') *
			MILLISECONDS_PER_SECOND;
		const cutoff = new Date(
			(await databaseNow(this.entityManager)).getTime() - intervalMilliseconds
		);
		const volumes = await this.entityManager.find(
			Volume,
			{
				state: VolumeState.READY,
				activeAttachmentId: { $ne: null },
				backupState: { $ne: VolumeBackupState.PENDING },
				$or: [{ lastBackupAt: null }, { lastBackupAt: { $lt: cutoff } }],
			},
			{
				orderBy: { lastBackupAt: QueryOrder.ASC_NULLS_FIRST },
				limit: VOLUME_BACKUP_SCHEDULE.VOLUME_BATCH_SIZE,
			}
		);
		const sandboxIds = [
			...new Set(
				volumes.flatMap(({ activeAttachmentId }) =>
					activeAttachmentId ? [activeAttachmentId] : []
				)
			),
		];
		if (sandboxIds.length === 0) {
			return [];
		}
		const sandboxes = await this.entityManager.find(Sandbox, {
			id: { $in: sandboxIds },
			state: SandboxState.STARTED,
		});
		const busyJobs = await this.entityManager.find(
			Job,
			{
				resourceType: ResourceType.SANDBOX,
				resourceId: { $in: sandboxIds },
				type: { $in: [...BACKUP_JOB_TYPES] },
				completedAt: null,
			},
			{ fields: ['resourceId'] }
		);
		const readyMachines = await this.entityManager.find(
			Machine,
			{
				id: {
					$in: sandboxes.flatMap(({ machineId }) =>
						machineId ? [machineId] : []
					),
				},
				state: MachineState.READY,
			},
			{ fields: ['id'] }
		);
		return selectDueVolumeBackups({
			volumes,
			sandboxes,
			busySandboxIds: new Set(busyJobs.map(({ resourceId }) => resourceId)),
			readyMachineIds: new Set(readyMachines.map(({ id }) => id)),
			cutoff,
		});
	}

	private async dispatch(backup: DueVolumeBackup): Promise<void> {
		try {
			await this.entityManager.transactional(
				async () => {
					const requests = await this.volumeBackupService.prepareForSandbox(
						backup.sandboxId,
						backup.machineId,
						backup.organizationId,
						backup.volumeIds
					);
					await this.machineJobDispatch.backupVolumes(
						{ id: backup.machineId },
						backup.sandboxId,
						requests
					);
				},
				{ propagation: TransactionPropagation.REQUIRED }
			);
		} catch (error) {
			this.logger.warn(
				`Failed to schedule volume backup of sandbox ${backup.sandboxId}: ${errorMessage(error)}`
			);
		}
	}
}
