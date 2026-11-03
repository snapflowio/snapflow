/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { SandboxLifecycle } from '@snapflow/machine-proto';
import Redis from 'ioredis';
import { SECONDS_PER_MINUTE } from '../../../../common/constants/time.constants';
import { MachineService } from '../../../machine/services/machine.service';
import { BackupState } from '../../../volume/enums/backup-state.enum';
import { SandboxEvents } from '../../constants/sandbox-events.constants';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { SandboxBackupCreatedEvent } from '../../events/sandbox-backup-created.event';
import { SandboxRepository } from '../../repositories/sandbox.repository';
import { DONT_SYNC_AGAIN, SandboxAction, SyncState } from './sandbox.action';

const ARCHIVE_BACKUP_RETRY_LIMIT = 3;
const ARCHIVE_BACKUP_RETRY_WINDOW_MINUTES = 12;
const ARCHIVE_BACKUP_RETRY_WINDOW_SECONDS =
	ARCHIVE_BACKUP_RETRY_WINDOW_MINUTES * SECONDS_PER_MINUTE;
const ARCHIVE_BACKUP_RETRIES_EXHAUSTED_REASON = `Failed to archive sandbox after ${ARCHIVE_BACKUP_RETRY_LIMIT} retries`;
const ARCHIVABLE_STATES = new Set<SandboxState>([
	SandboxState.STOPPED,
	SandboxState.ARCHIVING,
	SandboxState.ERROR,
]);

function archiveBackupRetryKey(sandboxId: string): string {
	return `archive-error-retry-${sandboxId}`;
}

@Injectable()
export class SandboxArchiveAction extends SandboxAction {
	constructor(
		protected readonly machineService: MachineService,
		protected readonly sandboxRepository: SandboxRepository,
		@InjectRedis() private readonly redis: Redis,
		private readonly eventEmitter: EventEmitter2
	) {
		super(machineService, sandboxRepository);
	}

	async run(sandbox: Sandbox): Promise<SyncState> {
		if (!ARCHIVABLE_STATES.has(sandbox.state)) {
			return DONT_SYNC_AGAIN;
		}

		if (sandbox.backupState === BackupState.ERROR) {
			await this.retryBackup(sandbox);
			return DONT_SYNC_AGAIN;
		}

		if (sandbox.backupState !== BackupState.COMPLETED) {
			return DONT_SYNC_AGAIN;
		}

		if (!sandbox.machineId || sandbox.runtimeLifecycle === null) {
			await this.markArchived(sandbox);
			return DONT_SYNC_AGAIN;
		}
		if (sandbox.runtimeLifecycle !== SandboxLifecycle.DESTROYED) {
			await this.updateSandboxState(
				sandbox,
				{ state: sandbox.state },
				{ runtimeIntent: { lifecycle: SandboxLifecycle.DESTROYED } }
			);
		}
		return DONT_SYNC_AGAIN;
	}

	private async markArchived(sandbox: Sandbox): Promise<void> {
		if (sandbox.state === SandboxState.ERROR) {
			this.logger.warn(
				`Transitioning sandbox ${sandbox.id} from ERROR to ARCHIVED state (machine draining)`
			);
		}
		await this.updateSandboxState(sandbox, {
			state: SandboxState.ARCHIVED,
			machineId: null,
			recoverable: false,
		});
	}

	private async retryBackup(sandbox: Sandbox): Promise<void> {
		const retryKey = archiveBackupRetryKey(sandbox.id);
		const retryCount = Number.parseInt(
			(await this.redis.get(retryKey)) ?? '0',
			10
		);
		if (retryCount >= ARCHIVE_BACKUP_RETRY_LIMIT) {
			if (sandbox.state !== SandboxState.ERROR) {
				await this.updateSandboxState(sandbox, {
					state: SandboxState.ERROR,
					errorReason: ARCHIVE_BACKUP_RETRIES_EXHAUSTED_REASON,
					recoverable: sandbox.recoverable,
				});
			}
			await this.redis.del(retryKey);
			return;
		}

		await this.redis.setex(
			retryKey,
			ARCHIVE_BACKUP_RETRY_WINDOW_SECONDS,
			String(retryCount + 1)
		);
		this.eventEmitter.emit(
			SandboxEvents.BACKUP_CREATED,
			new SandboxBackupCreatedEvent(sandbox)
		);
	}
}
