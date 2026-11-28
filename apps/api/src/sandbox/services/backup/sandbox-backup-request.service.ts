/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IsolatedEntityManagerContext } from '../../../common/decorators/isolated-entity-manager-context.decorator';
import { TrackJobExecution } from '../../../common/decorators/track-job-execution.decorator';
import { TrackedJobs } from '../../../common/utils/concurrency/tracked-jobs.util';
import { apiError } from '../../../common/utils/error/api-error.util';
import { errorMessage } from '../../../common/utils/error/error.util';
import { ImageReference } from '../../../common/values/image-reference.value';
import { DockerRegistry } from '../../../docker-registry/entities/docker-registry.entity';
import { DockerRegistryService } from '../../../docker-registry/services/docker-registry.service';
import { RedisLockProvider } from '../../../infra/redis/providers/redis-lock.provider';
import { Job } from '../../../machine-job/entities/job.entity';
import { BACKUP_JOB_TYPES } from '../../../machine-job/enums/job-type.enum';
import { ResourceType } from '../../../machine-job/enums/resource-type.enum';
import { BackupState } from '../../../volume/enums/backup-state.enum';
import {
	SANDBOX_BACKUP_LOCK_TTL_SECONDS,
	sandboxBackupLockKey,
} from '../../constants/backup.constants';
import { SandboxEvents } from '../../constants/sandbox-events.constants';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxErrorCode } from '../../enums/sandbox-error-code.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { SandboxArchivedEvent } from '../../events/sandbox-archived.event';
import { SandboxBackupCompletedEvent } from '../../events/sandbox-backup-completed.event';
import { SandboxBackupCreatedEvent } from '../../events/sandbox-backup-created.event';
import { SandboxDestroyedEvent } from '../../events/sandbox-destroyed.event';
import {
	backupRepository,
	backupSnapshotName,
} from '../../utils/backup-repository.util';
import { SandboxBackupStateService } from './sandbox-backup-state.service';

const BACKUP_PRUNE_BLOCKING_STATES: ReadonlySet<SandboxState> = new Set([
	SandboxState.RESTORING,
	SandboxState.ARCHIVING,
]);

type SetBackupPendingOptions = Readonly<{
	replaceCompleted?: boolean;
}>;

@Injectable()
export class SandboxBackupRequestService extends TrackedJobs {
	protected readonly logger = new Logger(SandboxBackupRequestService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly dockerRegistryService: DockerRegistryService,
		private readonly backupState: SandboxBackupStateService,
		private readonly redisLockProvider: RedisLockProvider
	) {
		super();
	}

	async setBackupPending(
		sandbox: Sandbox,
		{ replaceCompleted = false }: SetBackupPendingOptions = {}
	): Promise<void> {
		if (sandbox.backupState === BackupState.COMPLETED && !replaceCompleted) {
			return;
		}

		if (!isBackupEligible(sandbox)) {
			throw new BadRequestException(
				apiError(
					SandboxErrorCode.STATE_INVALID,
					'A backup needs a started, stopped or errored sandbox that is placed on a machine. Wait for the sandbox to settle, then try again.'
				)
			);
		}

		if (
			sandbox.backupState === BackupState.IN_PROGRESS ||
			sandbox.backupState === BackupState.PENDING
		) {
			return;
		}

		const registry = await this.backupRegistryFor(sandbox);
		if (!registry) {
			throw new BadRequestException(
				apiError(
					SandboxErrorCode.BACKUP_UNAVAILABLE,
					'Backups are unavailable right now. Try again later; if it keeps happening, contact support@snapflow.io.'
				)
			);
		}

		await this.backupState.update(sandbox.id, BackupState.PENDING, {
			backupSnapshot: backupSnapshotName(registry, sandbox.id, new Date()),
			backupRegistryId: registry.id,
		});
	}

	@OnEvent(SandboxEvents.ARCHIVED)
	@TrackJobExecution()
	@IsolatedEntityManagerContext()
	async handleSandboxArchivedEvent(event: SandboxArchivedEvent): Promise<void> {
		const sandbox = await this.currentSandbox(event.sandbox.id);
		if (sandbox) await this.setBackupPending(sandbox);
	}

	@OnEvent(SandboxEvents.BACKUP_CREATED)
	@TrackJobExecution()
	@IsolatedEntityManagerContext()
	async handleSandboxBackupCreatedEvent(
		event: SandboxBackupCreatedEvent
	): Promise<void> {
		const sandbox = await this.currentSandbox(event.sandbox.id);
		if (sandbox) {
			await this.setBackupPending(sandbox, { replaceCompleted: true });
		}
	}

	@OnEvent(SandboxEvents.BACKUP_COMPLETED)
	@TrackJobExecution()
	@IsolatedEntityManagerContext()
	async handleSandboxBackupCompletedEvent(
		event: SandboxBackupCompletedEvent
	): Promise<void> {
		await this.redisLockProvider.runExclusive(
			sandboxBackupLockKey(event.sandbox.id),
			SANDBOX_BACKUP_LOCK_TTL_SECONDS,
			() => this.pruneSupersededBackups(event.sandbox.id)
		);
	}

	@OnEvent(SandboxEvents.DESTROYED)
	@TrackJobExecution()
	@IsolatedEntityManagerContext()
	async handleSandboxDestroyedEvent(
		event: SandboxDestroyedEvent
	): Promise<void> {
		const sandbox = await this.currentSandbox(event.sandbox.id);
		if (sandbox) await this.deleteBackupRepository(sandbox);
	}

	private async backupRegistryFor(
		sandbox: Sandbox
	): Promise<DockerRegistry | null> {
		if (!sandbox.backupRegistryId) {
			return this.dockerRegistryService.getAvailableBackupRegistry();
		}
		return this.dockerRegistryService.findOne(sandbox.backupRegistryId);
	}

	private async deleteBackupRepository(sandbox: Sandbox): Promise<void> {
		if (!sandbox.backupRegistryId) {
			return;
		}
		const registry = await this.dockerRegistryService.findOne(
			sandbox.backupRegistryId
		);
		if (!registry) {
			this.logger.warn(
				`Backup registry ${sandbox.backupRegistryId} no longer exists; skipping repository cleanup`
			);
			return;
		}

		try {
			await this.dockerRegistryService.deleteRepository(
				backupRepository(registry, sandbox.id),
				registry
			);
		} catch (error) {
			this.logger.error(
				`Failed to delete backup repository ${sandbox.id} from registry ${registry.id}:`,
				error
			);
		}
	}

	private async pruneSupersededBackups(sandboxId: string): Promise<void> {
		const sandbox = await this.currentSandbox(sandboxId);
		if (
			!sandbox?.backupSnapshot ||
			!sandbox.backupRegistryId ||
			sandbox.backupState !== BackupState.COMPLETED ||
			BACKUP_PRUNE_BLOCKING_STATES.has(sandbox.state) ||
			(await this.backupJobOpen(sandbox.id))
		) {
			return;
		}
		const keptTag = ImageReference.parse(
			sandbox.backupSnapshot
		).manifestReference;
		const registry = await this.dockerRegistryService.findOne(
			sandbox.backupRegistryId
		);
		if (!keptTag || !registry) return;
		try {
			const deleted = await this.dockerRegistryService.deleteTagsExcept(
				backupRepository(registry, sandbox.id),
				registry,
				[keptTag]
			);
			if (deleted > 0) {
				this.logger.debug(
					`Removed ${deleted} superseded backups of sandbox ${sandbox.id}`
				);
			}
		} catch (error) {
			this.logger.error(
				`Failed to remove superseded backups of sandbox ${sandbox.id}: ${errorMessage(error)}`
			);
		}
	}

	private async backupJobOpen(sandboxId: string): Promise<boolean> {
		return (
			(await this.entityManager.count(Job, {
				resourceType: ResourceType.SANDBOX,
				resourceId: sandboxId,
				type: { $in: [...BACKUP_JOB_TYPES] },
				completedAt: null,
			})) > 0
		);
	}

	private currentSandbox(sandboxId: string): Promise<Sandbox | null> {
		return this.entityManager.findOne(Sandbox, { id: sandboxId });
	}
}

function isBackupEligible(sandbox: Sandbox): boolean {
	switch (sandbox.state) {
		case SandboxState.STARTED:
		case SandboxState.ARCHIVING:
			return true;
		case SandboxState.STOPPED:
		case SandboxState.ERROR:
			return Boolean(sandbox.machineId);
		default:
			return false;
	}
}
