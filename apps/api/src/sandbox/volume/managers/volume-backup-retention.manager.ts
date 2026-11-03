/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode, TransactionPropagation } from '@mikro-orm/core';
import { CreateRequestContext } from '@mikro-orm/decorators/legacy';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { LogExecution } from '../../../common/decorators/log-execution.decorator';
import { TrackJobExecution } from '../../../common/decorators/track-job-execution.decorator';
import { settleSequentially } from '../../../common/utils/concurrency/sequential-async.util';
import { TrackedJobs } from '../../../common/utils/concurrency/tracked-jobs.util';
import { errorMessage } from '../../../common/utils/error/error.util';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { RedisLockProvider } from '../../../infra/redis/providers/redis-lock.provider';
import { ObjectStorageService } from '../../../object-storage/services/object-storage.service';
import {
	VOLUME_BACKUP_RETENTION,
	VolumeBackupJobName,
} from '../constants/volume-backup.constants';
import { Volume } from '../entities/volume.entity';
import { VolumeBackup } from '../entities/volume-backup.entity';
import { VolumeBackupState } from '../enums/volume-backup-state.enum';
import { VolumeState } from '../enums/volume-state.enum';
import {
	volumeBackupObjectKeys,
	volumeBackupPrefix,
} from '../utils/volume-backup-object-key.util';
import {
	planVolumeBackupRetention,
	type VolumeBackupRetentionPlan,
} from '../utils/volume-backup-retention.util';

type VolumeRow = { volumeId: string };

type RetentionWork =
	| { deletedVolumePrefix: string }
	| { plan: VolumeBackupRetentionPlan };

@Injectable()
export class VolumeBackupRetentionManager extends TrackedJobs {
	protected readonly logger = new Logger(VolumeBackupRetentionManager.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly redisLockProvider: RedisLockProvider,
		private readonly objectStorageService: ObjectStorageService
	) {
		super();
	}

	get em(): EntityManager {
		return this.entityManager;
	}

	@TrackJobExecution()
	@LogExecution(VolumeBackupJobName.PRUNE)
	@CreateRequestContext()
	async pruneVolumeBackups(): Promise<void> {
		await this.redisLockProvider.runExclusive(
			VolumeBackupJobName.PRUNE,
			VOLUME_BACKUP_RETENTION.LOCK_TTL_SECONDS,
			async () => {
				const rows = await this.entityManager.execute<VolumeRow[]>(
					`SELECT backup."volumeId" AS "volumeId"
					FROM volume_backup backup JOIN volume ON volume.id = backup."volumeId"
					GROUP BY backup."volumeId", volume.state
					HAVING volume.state = ?
						OR count(*) FILTER (WHERE backup.state = ?) > 0
						OR count(*) FILTER (WHERE backup.state = ? AND backup."prunedAt" IS NULL) > ?
					LIMIT ?`,
					[
						VolumeState.DELETED,
						VolumeBackupState.ERROR,
						VolumeBackupState.COMPLETED,
						VOLUME_BACKUP_RETENTION.RETAINED_COMPLETED_BACKUPS,
						VOLUME_BACKUP_RETENTION.VOLUME_BATCH_SIZE,
					]
				);
				await settleSequentially(rows, async ({ volumeId }) => {
					try {
						await this.pruneVolume(volumeId);
					} catch (error) {
						this.logger.error(
							`Failed to prune backups of volume ${volumeId}: ${errorMessage(error)}`
						);
					}
				});
			}
		);
	}

	async pruneVolume(volumeId: string): Promise<void> {
		const work = await this.planVolume(volumeId);
		if (!work) return;
		if ('deletedVolumePrefix' in work) {
			await this.objectStorageService.deletePrefix(work.deletedVolumePrefix);
			await this.entityManager.nativeDelete(VolumeBackup, { volumeId });
			return;
		}
		const { pruneManifests, deleteBackups } = work.plan;
		await this.objectStorageService.deleteObjects([
			...pruneManifests.map(
				(backup) => volumeBackupObjectKeys(backup).manifest
			),
			...deleteBackups.flatMap((backup) => {
				const keys = volumeBackupObjectKeys(backup);
				return [keys.pack, keys.manifest];
			}),
		]);
		await this.entityManager.transactional(
			async (manager) => {
				if (pruneManifests.length > 0) {
					await manager.nativeUpdate(
						VolumeBackup,
						{
							artifactId: {
								$in: pruneManifests.map(({ artifactId }) => artifactId),
							},
							prunedAt: null,
						},
						{ prunedAt: await databaseNow(manager) }
					);
				}
				if (deleteBackups.length > 0) {
					await manager.nativeDelete(VolumeBackup, {
						artifactId: {
							$in: deleteBackups.map(({ artifactId }) => artifactId),
						},
						state: { $ne: VolumeBackupState.PENDING },
					});
				}
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	private async planVolume(volumeId: string): Promise<RetentionWork | null> {
		return this.entityManager.transactional(
			async (manager): Promise<RetentionWork | null> => {
				const volume = await manager.findOne(
					Volume,
					{ id: volumeId },
					{ lockMode: LockMode.PESSIMISTIC_WRITE }
				);
				const backups = await manager.find(VolumeBackup, { volumeId });
				if (!volume || backups.length === 0) {
					return null;
				}
				if (volume.state === VolumeState.DELETED) {
					return { deletedVolumePrefix: volumeBackupPrefix(backups[0]) };
				}
				return { plan: planVolumeBackupRetention(volume, backups) };
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}
}
