/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	LockMode,
	RequestContext,
	TransactionPropagation,
} from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { errorMessage } from '../../../common/utils/error/error.util';
import { RedisLockProvider } from '../../../infra/redis/providers/redis-lock.provider';
import { SANDBOX_WORKER_LIMITS } from '../../constants/sandbox.constants';
import type { Job } from '../../machine-job/entities/job.entity';
import { JobType } from '../../machine-job/enums/job-type.enum';
import { ResourceType } from '../../machine-job/enums/resource-type.enum';
import { JobService } from '../../machine-job/services/job.service';
import { Volume } from '../entities/volume.entity';
import { VolumeState } from '../enums/volume-state.enum';
import { markVolumeDeleted } from '../utils/volume-deletion.util';

const volumeDeletionLock = 'process-pending-volume-deletions';
const volumeDeletionLockSeconds = 30;

@Injectable()
export class VolumeManager {
	private readonly logger = new Logger(VolumeManager.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly jobService: JobService,
		private readonly redisLockProvider: RedisLockProvider
	) {}

	async processPendingVolumes(): Promise<void> {
		await RequestContext.create(this.entityManager, () =>
			this.processPendingVolumesInContext()
		);
	}

	private async processPendingVolumesInContext(): Promise<void> {
		await this.redisLockProvider.runExclusive(
			volumeDeletionLock,
			volumeDeletionLockSeconds,
			async () => {
				const pending = await this.entityManager.find(
					Volume,
					{ state: VolumeState.PENDING_DELETE },
					{
						fields: ['id'],
						orderBy: { createdAt: 'ASC', id: 'ASC' },
						limit: SANDBOX_WORKER_LIMITS.volumeDeletionBatchSize,
					}
				);
				for (const volume of pending) {
					await this.scheduleDeletion(volume.id);
				}
			}
		);
	}

	async scheduleDeletion(volumeId: string): Promise<void> {
		try {
			const job = await this.entityManager.transactional(
				async (manager): Promise<Job | null> => {
					const volume = await manager.findOne(
						Volume,
						{ id: volumeId },
						{ lockMode: LockMode.PESSIMISTIC_WRITE }
					);
					if (!volume || volume.state !== VolumeState.PENDING_DELETE) {
						return null;
					}
					if (volume.activeAttachmentId) {
						throw new Error(
							`Volume ${volume.id} still has an active attachment`
						);
					}
					if (!volume.homeMachineId) {
						markVolumeDeleted(volume);
						return null;
					}

					const deletionJob = await this.jobService.createJob(
						manager,
						JobType.DELETE_VOLUME,
						volume.homeMachineId,
						ResourceType.VOLUME,
						volume.id
					);
					volume.state = VolumeState.DELETING;
					return deletionJob;
				},
				{ propagation: TransactionPropagation.REQUIRED }
			);
			if (job) {
				this.jobService.notifyCreatedJob(job);
			}
		} catch (error) {
			const message = errorMessage(error);
			this.logger.error(
				`Failed to schedule deletion for ${volumeId}: ${message}`
			);
			await this.entityManager.transactional(
				async (manager) => {
					const volume = await manager.findOne(
						Volume,
						{ id: volumeId, state: VolumeState.PENDING_DELETE },
						{ lockMode: LockMode.PESSIMISTIC_WRITE }
					);
					if (!volume) return;

					volume.state = VolumeState.ERROR;
					volume.errorReason = message;
				},
				{ propagation: TransactionPropagation.REQUIRED }
			);
		}
	}
}
