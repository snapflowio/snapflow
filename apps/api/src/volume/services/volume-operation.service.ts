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
} from '@nestjs/common';
import {
	ResizeVolumePayloadSchema,
	RestoreVolumePayloadSchema,
} from '@snapflow/machine-proto';
import { CommonErrorCode } from '../../common/enums/common-error-code.enum';
import {
	apiError,
	commonApiError,
} from '../../common/utils/error/api-error.util';
import { JobType } from '../../machine-job/enums/job-type.enum';
import { ResourceType } from '../../machine-job/enums/resource-type.enum';
import { JobService } from '../../machine-job/services/job.service';
import { MachineSchedulingService } from '../../placement/services/machine-scheduling.service';
import { platformWorkloadPlacement } from '../../placement/utils/sandbox-placement.util';
import { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';
import { SandboxErrorCode } from '../../sandbox/enums/sandbox-error-code.enum';
import { Volume } from '../entities/volume.entity';
import { VolumeErrorCode } from '../enums/volume-error-code.enum';
import { VolumeState } from '../enums/volume-state.enum';
import { VolumeNotFoundException } from '../exceptions/volume-not-found.exception';
import { VolumeBackupService } from './volume-backup.service';

const RESTORABLE_STATES: ReadonlySet<VolumeState> = new Set([
	VolumeState.READY,
	VolumeState.ERROR,
]);

function assertResizable(volume: Volume, targetSizeGiB: number): void {
	if (volume.state !== VolumeState.READY) {
		throw new ConflictException(
			apiError(
				VolumeErrorCode.NOT_READY,
				`Volume ${volume.id} is not ready yet. Wait until it is ready, then resize it.`
			)
		);
	}
	if (volume.activeAttachmentId) {
		throw new ConflictException(
			apiError(
				VolumeErrorCode.IN_USE,
				'The volume is attached to a sandbox. Detach it, then resize it.'
			)
		);
	}
	if (targetSizeGiB < volume.sizeGiB) {
		throw new BadRequestException(
			apiError(
				VolumeErrorCode.SHRINK_NOT_SUPPORTED,
				'Volumes cannot shrink. Request a size at least as large as the current size.'
			)
		);
	}
}

function assertRestorable(volume: Volume): asserts volume is Volume & {
	backupArtifactId: string;
	backupGeneration: number;
} {
	if (!volume.backupArtifactId || !volume.backupGeneration) {
		throw new ConflictException(
			apiError(
				VolumeErrorCode.BACKUP_MISSING,
				`Volume ${volume.id} has no completed backup yet. Wait for a backup to finish, then restore.`
			)
		);
	}
	if (volume.activeAttachmentId) {
		throw new ConflictException(
			apiError(
				VolumeErrorCode.IN_USE,
				'The volume is attached to a sandbox. Detach it, then restore it.'
			)
		);
	}
	if (!RESTORABLE_STATES.has(volume.state)) {
		throw new ConflictException(
			apiError(
				VolumeErrorCode.NOT_READY,
				`Volume ${volume.id} cannot be restored in its current state. Wait for its current operation to finish, then try again.`
			)
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
		return this.entityManager.transactional(
			async (manager): Promise<Volume> => {
				const volume = await manager.findOne(
					Volume,
					{ id: volumeId },
					{ lockMode: LockMode.PESSIMISTIC_WRITE }
				);
				if (!volume) {
					throw new VolumeNotFoundException(volumeId);
				}
				assertResizable(volume, targetSizeGiB);
				if (targetSizeGiB === volume.sizeGiB) {
					return volume;
				}
				if (!volume.homeMachineId) {
					volume.sizeGiB = targetSizeGiB;
					return volume;
				}
				await this.jobService.createJob(
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
				return volume;
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
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
			throw new VolumeNotFoundException(volumeId);
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

		const persist = async (manager: EntityManager): Promise<Volume> => {
			const volume = await manager.findOne(
				Volume,
				{ id: volumeId },
				{ lockMode: LockMode.PESSIMISTIC_WRITE }
			);
			if (!volume) {
				throw new VolumeNotFoundException(volumeId);
			}
			if (
				volume.activeAttachmentId ||
				!RESTORABLE_STATES.has(volume.state) ||
				volume.backupArtifactId !== backup.manifest?.artifactId ||
				volume.backupGeneration !== payload.backupGeneration
			) {
				throw new ConflictException(
					commonApiError(CommonErrorCode.RESOURCE_MODIFIED)
				);
			}
			await this.jobService.createJob(
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
			return volume;
		};
		return entityManager
			? persist(entityManager)
			: this.entityManager.transactional(persist, {
					propagation: TransactionPropagation.REQUIRED,
				});
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
				apiError(
					SandboxErrorCode.NO_AVAILABLE_MACHINE,
					'No machine that stores volumes is available right now. Try again later.'
				)
			);
		}
		return fallback;
	}
}
