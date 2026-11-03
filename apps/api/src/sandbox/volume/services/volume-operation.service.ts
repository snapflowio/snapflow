/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { create, toJson, toJsonString } from '@bufbuild/protobuf';
import { LockMode, TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import {
	ResizeVolumePayloadSchema,
	RestoreVolumePayloadSchema,
} from '@snapflow/machine-proto';
import { SandboxClass } from '../../instance/enums/sandbox-class.enum';
import type { Job } from '../../machine-job/entities/job.entity';
import { JobType } from '../../machine-job/enums/job-type.enum';
import { ResourceType } from '../../machine-job/enums/resource-type.enum';
import { JobService } from '../../machine-job/services/job.service';
import { MachineSchedulingService } from '../../placement/services/machine-scheduling.service';
import { platformWorkloadPlacement } from '../../placement/utils/sandbox-placement.util';
import { Volume } from '../entities/volume.entity';
import { VolumeState } from '../enums/volume-state.enum';
import { VolumeBackupService } from './volume-backup.service';

const RESTORABLE_STATES: ReadonlySet<VolumeState> = new Set([
	VolumeState.READY,
	VolumeState.ERROR,
]);

function assertResizable(volume: Volume, targetSizeGiB: number): void {
	if (volume.state !== VolumeState.READY) {
		throw new ConflictException(`Volume ${volume.id} is not ready to resize`);
	}
	if (volume.activeAttachmentId) {
		throw new ConflictException('A volume must be detached before resize');
	}
	if (targetSizeGiB < volume.sizeGiB) {
		throw new BadRequestException('Persistent volumes cannot shrink');
	}
}

function assertRestorable(volume: Volume): asserts volume is Volume & {
	backupArtifactId: string;
	backupGeneration: number;
} {
	if (!volume.backupArtifactId || !volume.backupGeneration) {
		throw new ConflictException(
			`Volume ${volume.id} has no completed portable backup`
		);
	}
	if (volume.activeAttachmentId) {
		throw new ConflictException('A volume must be detached before restore');
	}
	if (!RESTORABLE_STATES.has(volume.state)) {
		throw new ConflictException(
			`Volume ${volume.id} is not available for restore`
		);
	}
}

@Injectable()
export class VolumeOperationService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly jobService: JobService,
		private readonly machineScheduling: MachineSchedulingService,
		private readonly volumeBackupService: VolumeBackupService
	) {}

	async resize(volumeId: string, targetSizeGiB: number): Promise<Volume> {
		const result = await this.entityManager.transactional(
			async (manager): Promise<{ volume: Volume; job: Job | null }> => {
				const volume = await manager.findOne(
					Volume,
					{ id: volumeId },
					{ lockMode: LockMode.PESSIMISTIC_WRITE }
				);
				if (!volume) {
					throw new NotFoundException(`Volume with ID ${volumeId} not found`);
				}
				assertResizable(volume, targetSizeGiB);
				if (targetSizeGiB === volume.sizeGiB) {
					return { volume, job: null };
				}
				if (!volume.homeMachineId) {
					volume.sizeGiB = targetSizeGiB;
					return { volume, job: null };
				}
				const job = await this.jobService.createJob(
					manager,
					JobType.RESIZE_VOLUME,
					volume.homeMachineId,
					ResourceType.VOLUME,
					volume.id,
					toJsonString(
						ResizeVolumePayloadSchema,
						create(ResizeVolumePayloadSchema, { targetSizeGiB })
					)
				);
				volume.targetSizeGiB = targetSizeGiB;
				volume.state = VolumeState.RESIZING;
				volume.errorReason = null;
				return { volume, job };
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
		if (result.job) {
			this.jobService.notifyCreatedJob(result.job);
		}
		return result.volume;
	}

	async restore(
		volumeId: string,
		entityManager?: EntityManager
	): Promise<Volume> {
		const current = await (entityManager ?? this.entityManager).findOne(
			Volume,
			{
				id: volumeId,
			}
		);
		if (!current) {
			throw new NotFoundException(`Volume with ID ${volumeId} not found`);
		}
		assertRestorable(current);

		const machine = await this.selectRestoreMachine(current);
		const backup =
			await this.volumeBackupService.createRestoreRequest(volumeId);
		const payload = create(RestoreVolumePayloadSchema, {
			name: current.name,
			sizeGiB: current.sizeGiB,
			filesystem: current.filesystem,
			backupGeneration: current.backupGeneration,
			backup,
		});
		const payloadJson = JSON.stringify(
			toJson(RestoreVolumePayloadSchema, payload)
		);

		const persist = async (
			manager: EntityManager
		): Promise<{ volume: Volume; job: Job }> => {
			const volume = await manager.findOne(
				Volume,
				{ id: volumeId },
				{ lockMode: LockMode.PESSIMISTIC_WRITE }
			);
			if (!volume) {
				throw new NotFoundException(`Volume with ID ${volumeId} not found`);
			}
			if (
				volume.activeAttachmentId ||
				!RESTORABLE_STATES.has(volume.state) ||
				volume.backupArtifactId !== backup.manifest?.artifactId ||
				volume.backupGeneration !== payload.backupGeneration
			) {
				throw new ConflictException(
					`Volume ${volumeId} changed while restore was being prepared`
				);
			}
			const job = await this.jobService.createJob(
				manager,
				JobType.RESTORE_VOLUME,
				machine.id,
				ResourceType.VOLUME,
				volume.id,
				payloadJson
			);
			volume.homeMachineId = machine.id;
			volume.state = VolumeState.RESTORING;
			volume.errorReason = null;
			return { volume, job };
		};
		const result = entityManager
			? await persist(entityManager)
			: await this.entityManager.transactional(persist, {
					propagation: TransactionPropagation.REQUIRED,
				});
		if (!entityManager) this.jobService.notifyCreatedJob(result.job);
		return result.volume;
	}

	private async selectRestoreMachine(volume: Volume) {
		const parameters = {
			customerOrganizationId: volume.organizationId,
			placement: platformWorkloadPlacement(),
			sandboxClass: SandboxClass.LINUX_VM,
			gpu: 0,
			gpuType: null,
			requiresVolumes: true,
		};
		const preferred = await this.machineScheduling.findBestMachine({
			...parameters,
			excludedMachineIds: volume.homeMachineId ? [volume.homeMachineId] : [],
		});
		if (preferred) {
			return preferred;
		}
		const fallback = await this.machineScheduling.findBestMachine(parameters);
		if (!fallback) {
			throw new BadRequestException(
				'No machine that runs persistent volumes is available'
			);
		}
		return fallback;
	}
}
