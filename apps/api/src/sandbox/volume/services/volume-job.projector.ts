/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { fromJsonString } from '@bufbuild/protobuf';
import type { EntityRepository } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import {
	BackupVolumesPayloadSchema,
	BackupVolumesResultSchema,
	ResizeVolumePayloadSchema,
	type RestoreVolumePayload,
	RestoreVolumePayloadSchema,
} from '@snapflow/machine-proto';
import { JobProjector } from '../../machine-job/decorators/job-projector.decorator';
import { Job } from '../../machine-job/entities/job.entity';
import { JobStatus } from '../../machine-job/enums/job-status.enum';
import { JobType } from '../../machine-job/enums/job-type.enum';
import type {
	JobProjection,
	JobTypeProjector,
} from '../../machine-job/types/job-projection.types';
import { Volume } from '../entities/volume.entity';
import { VolumeState } from '../enums/volume-state.enum';
import { completedVolumeBackupResults } from '../utils/volume-backup-job.util';
import { markVolumeDeleted } from '../utils/volume-deletion.util';
import { VolumeBackupService } from './volume-backup.service';

const DELETE_FAILURE_REASON = 'Failed to delete machine-local volume';
const RESIZE_FAILURE_REASON = 'Failed to resize persistent volume';
const RESTORE_FAILURE_REASON = 'Failed to restore persistent volume';
const RESTORE_MISSING_PAYLOAD_REASON =
	'Completed volume restore is missing its payload';
const RESTORE_INVALID_PAYLOAD_REASON =
	'Completed volume restore payload is invalid';

@JobProjector()
@Injectable()
export class VolumeJobProjector implements JobTypeProjector {
	readonly projections: ReadonlyMap<JobType, JobProjection> = new Map<
		JobType,
		JobProjection
	>([
		[JobType.BACKUP_VOLUMES, (job) => this.projectBackup(job)],
		[JobType.DELETE_VOLUME, (job) => this.projectDelete(job)],
		[JobType.RESIZE_VOLUME, (job) => this.projectResize(job)],
		[JobType.RESTORE_VOLUME, (job) => this.projectRestore(job)],
	]);

	private readonly logger = new Logger(VolumeJobProjector.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly volumeBackupService: VolumeBackupService
	) {}

	private get volumeRepository(): EntityRepository<Volume> {
		return this.entityManager.getRepository(Volume);
	}

	private async findVolume(job: Job): Promise<Volume | null> {
		const volume = await this.volumeRepository.findOne({ id: job.resourceId });
		if (!volume) {
			this.logger.warn(
				`Volume ${job.resourceId} no longer exists for ${job.type} job ${job.id}`
			);
		}
		return volume;
	}

	async projectBackup(job: Job): Promise<void> {
		if (!job.payload) {
			throw new Error(`${job.type} job ${job.id} has no payload`);
		}
		await this.volumeBackupService.applyJobCompletion(
			job,
			fromJsonString(BackupVolumesPayloadSchema, job.payload).volumeBackups,
			completedVolumeBackupResults(job, BackupVolumesResultSchema)
		);
	}

	async projectDelete(job: Job): Promise<void> {
		const volume = await this.findVolume(job);
		if (!volume) return;
		if (job.status === JobStatus.FAILED) {
			volume.state = VolumeState.ERROR;
			volume.errorReason = job.errorMessage ?? DELETE_FAILURE_REASON;
			await this.entityManager.flush();
			return;
		}
		markVolumeDeleted(volume);
		await this.entityManager.flush();
	}

	async projectResize(job: Job): Promise<void> {
		const volume = await this.findVolume(job);
		if (!volume) return;
		const requestedSize = job.payload
			? fromJsonString(ResizeVolumePayloadSchema, job.payload).targetSizeGiB
			: undefined;
		if (requestedSize === undefined || requestedSize !== volume.targetSizeGiB) {
			this.logger.warn(`Ignoring stale resize result for volume ${volume.id}`);
			return;
		}
		volume.state = VolumeState.READY;
		volume.targetSizeGiB = undefined;
		if (job.status === JobStatus.COMPLETED) {
			volume.sizeGiB = requestedSize;
			volume.errorReason = undefined;
		} else {
			volume.errorReason = job.errorMessage ?? RESIZE_FAILURE_REASON;
		}
		await this.entityManager.flush();
	}

	async projectRestore(job: Job): Promise<void> {
		const volume = await this.findVolume(job);
		if (!volume) return;
		if (
			volume.state !== VolumeState.RESTORING ||
			volume.homeMachineId !== job.machineId
		) {
			this.logger.warn(`Ignoring stale restore result for volume ${volume.id}`);
			return;
		}

		if (job.status === JobStatus.FAILED) {
			await this.failRestore(
				volume,
				job.errorMessage ?? RESTORE_FAILURE_REASON
			);
			return;
		}
		if (!job.payload) {
			await this.failRestore(volume, RESTORE_MISSING_PAYLOAD_REASON);
			return;
		}

		let payload: RestoreVolumePayload;
		try {
			payload = fromJsonString(RestoreVolumePayloadSchema, job.payload);
		} catch (error) {
			this.logger.error(
				`Failed to validate restore payload for volume ${volume.id}`,
				error
			);
			await this.failRestore(volume, RESTORE_INVALID_PAYLOAD_REASON);
			return;
		}
		if (
			payload.backup?.manifest?.artifactId !== volume.backupArtifactId ||
			payload.backupGeneration !== volume.backupGeneration
		) {
			this.logger.warn(
				`Ignoring restore result with stale backup identity for volume ${volume.id}`
			);
			return;
		}
		volume.generation = payload.backupGeneration;
		volume.state = VolumeState.READY;
		volume.errorReason = undefined;
		await this.entityManager.flush();
	}

	private async failRestore(volume: Volume, reason: string): Promise<void> {
		volume.state = VolumeState.ERROR;
		volume.errorReason = reason;
		await this.entityManager.flush();
	}
}
