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
import { DockerRegistry } from '../../../docker-registry/persistence/entities/docker-registry.entity';
import { registryRepositoryPrefix } from '../../../docker-registry/persistence/utils/docker-registry-url.util';
import { DockerRegistryService } from '../../../docker-registry/services/docker-registry.service';
import { SandboxEvents } from '../../constants/sandbox-events.constants';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { SandboxArchivedEvent } from '../../events/sandbox-archived.event';
import { SandboxBackupCreatedEvent } from '../../events/sandbox-backup-created.event';
import { SandboxDestroyedEvent } from '../../events/sandbox-destroyed.event';
import { BackupState } from '../../volume/enums/backup-state.enum';
import { SandboxBackupStateService } from './sandbox-backup-state.service';

type SetBackupPendingOptions = Readonly<{
	replaceCompleted?: boolean;
}>;

const BACKUP_TAG_UNSAFE_CHARACTERS = /[:.]/g;
const BACKUP_TAG_SEPARATOR = '-';

@Injectable()
export class SandboxBackupRequestService extends TrackedJobs {
	protected readonly logger = new Logger(SandboxBackupRequestService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly dockerRegistryService: DockerRegistryService,
		private readonly backupState: SandboxBackupStateService
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
				'Sandbox must be started, stopped, or errored with assigned machine to create a backup'
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
			throw new BadRequestException('No backup registry configured');
		}

		await this.backupState.update(sandbox.id, BackupState.PENDING, {
			backupSnapshot: backupSnapshotName(registry, sandbox.id),
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
			await this.dockerRegistryService.deleteSandboxRepository(
				sandbox.id,
				registry
			);
		} catch (error) {
			this.logger.error(
				`Failed to delete backup repository ${sandbox.id} from registry ${registry.id}:`,
				error
			);
		}
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

function backupSnapshotName(
	registry: DockerRegistry,
	sandboxId: string
): string {
	const tag = new Date()
		.toISOString()
		.replace(BACKUP_TAG_UNSAFE_CHARACTERS, BACKUP_TAG_SEPARATOR);
	return `${registryRepositoryPrefix(registry)}/backup-${sandboxId}:${tag}`;
}
