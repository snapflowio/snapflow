/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { QueryOrder } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { DockerRegistryService } from '../../../docker-registry/services/docker-registry.service';
import { RedisLockProvider } from '../../../infra/redis/providers/redis-lock.provider';
import { MachineService } from '../../../machine/services/machine.service';
import { Job } from '../../../machine-job/entities/job.entity';
import { JobStatus } from '../../../machine-job/enums/job-status.enum';
import { JobType } from '../../../machine-job/enums/job-type.enum';
import { ResourceType } from '../../../machine-job/enums/resource-type.enum';
import { JobConflictException } from '../../../machine-job/exceptions/job-conflict.exception';
import { MachineJobDispatchService } from '../../../machine-job/services/machine-job-dispatch.service';
import { BackupState } from '../../../volume/enums/backup-state.enum';
import { VolumeBackupService } from '../../../volume/services/volume-backup.service';
import {
	concurrentBackupLimit,
	MACHINE_BACKUP_LOCK_TTL_SECONDS,
	machineBackupLockKey,
} from '../../constants/backup.constants';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxArtifactJobProjector } from './sandbox-artifact-job.projector';
import { SandboxBackupStateService } from './sandbox-backup-state.service';

@Injectable()
export class SandboxBackupExecutionService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly machineService: MachineService,
		private readonly machineJobDispatch: MachineJobDispatchService,
		private readonly volumeBackupService: VolumeBackupService,
		private readonly dockerRegistryService: DockerRegistryService,
		private readonly redisLockProvider: RedisLockProvider,
		private readonly sandboxArtifactJobProjector: SandboxArtifactJobProjector,
		private readonly backupState: SandboxBackupStateService
	) {}

	async advance(
		sandbox: Sandbox,
		handledStates: ReadonlySet<BackupState>
	): Promise<void> {
		if (!handledStates.has(sandbox.backupState)) return;
		switch (sandbox.backupState) {
			case BackupState.PENDING:
				await this.dispatchPendingBackup(sandbox);
				break;
			case BackupState.IN_PROGRESS:
				await this.checkBackupProgress(sandbox);
				break;
		}
	}

	private async dispatchPendingBackup(sandbox: Sandbox): Promise<void> {
		const { machineId, backupRegistryId, backupSnapshot } = sandbox;
		if (!machineId) {
			throw new Error(`Sandbox ${sandbox.id} has no assigned machine`);
		}
		if (!backupRegistryId || !backupSnapshot) {
			throw new Error(`Sandbox ${sandbox.id} has incomplete backup metadata`);
		}
		if (await this.volumeBackupInFlight(sandbox.id)) {
			return;
		}
		const lease = await this.redisLockProvider.acquire(
			machineBackupLockKey(machineId),
			MACHINE_BACKUP_LOCK_TTL_SECONDS
		);
		try {
			const machine = await this.machineService.findOneOrFail(machineId);
			const backupsInProgress = await this.entityManager.count(Sandbox, {
				machineId,
				backupState: BackupState.IN_PROGRESS,
			});
			if (backupsInProgress >= concurrentBackupLimit(machine.cpu)) {
				return;
			}

			const registry =
				await this.dockerRegistryService.findOne(backupRegistryId);
			if (!registry) {
				throw new Error('Registry not found');
			}

			const volumeBackups = await this.volumeBackupService.prepareForSandbox(
				sandbox.id,
				machine.id,
				sandbox.organizationId,
				sandbox.volumes.map((volume) => volume.volumeId)
			);
			await this.machineJobDispatch.createBackup(
				machine,
				sandbox,
				backupSnapshot,
				registry,
				volumeBackups
			);

			await this.backupState.markInProgressIfPending(sandbox.id);
		} catch (error) {
			if (error instanceof JobConflictException) {
				await this.backupState.markInProgressIfPending(sandbox.id);
				return;
			}
			await this.backupState.recordFailure(sandbox, error);
			throw error;
		} finally {
			await lease.release();
		}
	}

	private async volumeBackupInFlight(sandboxId: string): Promise<boolean> {
		const inFlight = await this.entityManager.count(Job, {
			resourceType: ResourceType.SANDBOX,
			resourceId: sandboxId,
			type: JobType.BACKUP_VOLUMES,
			completedAt: null,
		});
		return inFlight > 0;
	}

	private async checkBackupProgress(sandbox: Sandbox): Promise<void> {
		try {
			await this.reconcileBackupFromJob(sandbox);
		} catch (error) {
			await this.backupState.recordFailure(sandbox, error);
			throw error;
		}
	}

	private async reconcileBackupFromJob(sandbox: Sandbox): Promise<void> {
		const job = await this.entityManager.findOne(
			Job,
			{
				resourceType: ResourceType.SANDBOX,
				resourceId: sandbox.id,
				type: JobType.CREATE_BACKUP,
			},
			{ orderBy: { createdAt: QueryOrder.DESC } }
		);

		if (
			job?.status === JobStatus.COMPLETED ||
			job?.status === JobStatus.FAILED
		) {
			await this.sandboxArtifactJobProjector.projectBackup(job);
		}
	}
}
