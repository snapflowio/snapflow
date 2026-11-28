/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { fromJsonString } from '@bufbuild/protobuf';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import {
	CreateBackupPayloadSchema,
	CreateBackupResultSchema,
	SnapshotSandboxPayloadSchema,
	SnapshotSandboxResultSchema,
} from '@snapflow/machine-proto';
import { Machine } from '../../../machine/entities/machine.entity';
import { JobProjector } from '../../../machine-job/decorators/job-projector.decorator';
import { Job } from '../../../machine-job/entities/job.entity';
import { JobStatus } from '../../../machine-job/enums/job-status.enum';
import { JobType } from '../../../machine-job/enums/job-type.enum';
import type {
	JobProjection,
	JobTypeProjector,
} from '../../../machine-job/types/job-projection.types';
import { SNAPSHOT_CAPTURE } from '../../../snapshot/constants/snapshot-capture.constants';
import { Snapshot } from '../../../snapshot/entities/snapshot.entity';
import { SnapshotState } from '../../../snapshot/enums/snapshot-state.enum';
import { SnapshotRepository } from '../../../snapshot/repositories/snapshot.repository';
import { capturedSnapshotCompletion } from '../../../snapshot/utils/captured-snapshot.util';
import { BackupState } from '../../../volume/enums/backup-state.enum';
import { VolumeBackupService } from '../../../volume/services/volume-backup.service';
import { completedVolumeBackupResults } from '../../../volume/utils/volume-backup-job.util';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxPlacement } from '../../entities/sandbox-placement.entity';
import { SandboxDesiredState } from '../../enums/sandbox-desired-state.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { SandboxRepository } from '../../repositories/sandbox.repository';
import { sanitizeSandboxError } from '../../utils/sanitize-error.util';

function capturedSnapshotOutcome(
	job: Job,
	reference: string
): Partial<Snapshot> {
	if (job.status === JobStatus.COMPLETED && job.resultMetadata) {
		const result = fromJsonString(
			SnapshotSandboxResultSchema,
			job.resultMetadata
		);
		if (result.ref === reference) return capturedSnapshotCompletion(result);
	}
	return {
		state: SnapshotState.ERROR,
		errorReason: job.errorMessage
			? sanitizeSandboxError(job.errorMessage).errorReason
			: SNAPSHOT_CAPTURE.UNKNOWN_FAILURE_REASON,
	};
}

function backupSize(job: Job): Pick<Sandbox, 'backupSizeBytes'> | null {
	if (!job.resultMetadata) return null;
	const { backupSizeBytes } = fromJsonString(
		CreateBackupResultSchema,
		job.resultMetadata
	);
	return backupSizeBytes > 0n
		? { backupSizeBytes: backupSizeBytes.toString() }
		: null;
}

@JobProjector()
@Injectable()
export class SandboxArtifactJobProjector implements JobTypeProjector {
	readonly projections: ReadonlyMap<JobType, JobProjection> = new Map<
		JobType,
		JobProjection
	>([
		[JobType.CREATE_BACKUP, (job) => this.projectBackup(job)],
		[JobType.SNAPSHOT_SANDBOX, (job) => this.projectSandboxSnapshot(job)],
	]);

	private readonly logger = new Logger(SandboxArtifactJobProjector.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly sandboxRepository: SandboxRepository,
		private readonly snapshotRepository: SnapshotRepository,
		private readonly volumeBackupService: VolumeBackupService
	) {}

	private async findSandbox(job: Job): Promise<Sandbox | null> {
		const sandbox = await this.entityManager.findOne(Sandbox, {
			id: job.resourceId,
		});
		if (!sandbox) {
			this.logger.warn(
				`Sandbox ${job.resourceId} not found for ${job.type} job ${job.id}`
			);
		}
		return sandbox;
	}

	async projectBackup(job: Job): Promise<void> {
		const sandbox = await this.findSandbox(job);
		if (!sandbox || !job.payload) return;
		const payload = fromJsonString(CreateBackupPayloadSchema, job.payload);
		const jobSnapshot = payload.snapshot;
		if (!jobSnapshot) {
			throw new Error(`CREATE_BACKUP job ${job.id} has no snapshot payload`);
		}

		if (sandbox.backupSnapshot && jobSnapshot !== sandbox.backupSnapshot) {
			this.logger.warn(
				`Ignoring stale backup ${job.status} for sandbox ${sandbox.id}: job snapshot ${jobSnapshot} does not match ${sandbox.backupSnapshot}`
			);
			return;
		}

		await this.volumeBackupService.applyJobCompletion(
			job,
			payload.volumeBackups,
			completedVolumeBackupResults(job, CreateBackupResultSchema)
		);

		if (job.status !== JobStatus.COMPLETED) {
			await this.applyBackupFailure(job, sandbox);
			return;
		}
		if (sandbox.backupState === BackupState.COMPLETED) {
			return;
		}
		await this.apply(sandbox, {
			...Sandbox.getBackupStateUpdate(
				BackupState.COMPLETED,
				sandbox.backupSnapshot ? undefined : jobSnapshot
			),
			...backupSize(job),
		});
	}

	private async applyBackupFailure(job: Job, sandbox: Sandbox): Promise<void> {
		this.logger.error(
			`CREATE_BACKUP job ${job.id} failed for sandbox ${sandbox.id}: ${job.errorMessage}`
		);
		const { recoverable, errorReason } = sanitizeSandboxError(job.errorMessage);
		const isArchiveFlow = sandbox.desiredState === SandboxDesiredState.ARCHIVED;
		const isOnDrainingMachine =
			(await this.isCurrentAssignment(job)) &&
			(await this.machineIsDraining(sandbox));
		const updateData: Partial<Sandbox> = Sandbox.getBackupStateUpdate(
			BackupState.ERROR,
			undefined,
			undefined,
			errorReason,
			recoverable && (isArchiveFlow || isOnDrainingMachine)
		);
		if (
			isOnDrainingMachine &&
			recoverable &&
			sandbox.state !== SandboxState.ERROR
		) {
			updateData.state = SandboxState.ERROR;
			updateData.errorReason = errorReason;
		}
		await this.apply(sandbox, updateData);
	}

	async projectSandboxSnapshot(job: Job): Promise<void> {
		await this.settleCapturedSnapshot(job);
		const sandbox = await this.findSandbox(job);
		if (!sandbox) return;
		if (sandbox.state !== SandboxState.SNAPSHOTTING) {
			this.logger.warn(
				`Ignoring SNAPSHOT_SANDBOX job ${job.id}: sandbox ${sandbox.id} is ${sandbox.state}`
			);
			return;
		}
		if (!(await this.isCurrentAssignment(job))) {
			this.logger.warn(
				`Ignoring SNAPSHOT_SANDBOX job ${job.id}: assignment ${job.assignmentGeneration} of sandbox ${sandbox.id} is no longer active`
			);
			return;
		}
		const restingState = sandbox.restingState();
		if (!restingState) {
			this.logger.error(
				`Sandbox ${sandbox.id} has unexpected desired state ${sandbox.desiredState} for SNAPSHOT_SANDBOX job ${job.id}`
			);
			return;
		}
		await this.apply(sandbox, { state: restingState });
	}

	private async settleCapturedSnapshot(job: Job): Promise<void> {
		if (!job.payload) {
			throw new Error(`SNAPSHOT_SANDBOX job ${job.id} has no payload`);
		}
		const { reference } = fromJsonString(
			SnapshotSandboxPayloadSchema,
			job.payload
		);
		const snapshot = await this.entityManager.findOne(Snapshot, {
			ref: reference,
			state: SnapshotState.CAPTURING,
		});
		if (!snapshot) {
			this.logger.warn(
				`SNAPSHOT_SANDBOX job ${job.id} has no capturing snapshot for ${reference}`
			);
			return;
		}
		await this.snapshotRepository.update(snapshot.id, {
			entity: snapshot,
			updateData: capturedSnapshotOutcome(job, reference),
		});
	}

	private async isCurrentAssignment(job: Job): Promise<boolean> {
		const placement = await this.entityManager.findOne(SandboxPlacement, {
			sandboxId: job.resourceId,
			releasedAt: null,
		});
		return (
			placement?.machineId === job.machineId &&
			placement.assignmentGeneration === job.assignmentGeneration
		);
	}

	private async machineIsDraining(sandbox: Sandbox): Promise<boolean> {
		if (!sandbox.machineId) return false;
		const machine = await this.entityManager.findOne(
			Machine,
			{ id: sandbox.machineId },
			{ fields: ['draining'] }
		);
		return machine?.draining === true;
	}

	private async apply(
		sandbox: Sandbox,
		updateData: Partial<Sandbox>
	): Promise<Sandbox> {
		return this.sandboxRepository.update(sandbox.id, {
			updateData,
			entity: sandbox,
		});
	}
}
