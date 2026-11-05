/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxDesiredState } from '../../enums/sandbox-desired-state.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { SandboxConflictException } from '../../exceptions/sandbox-conflict.exception';
import { MachineService } from '../../machine/services/machine.service';
import { SandboxRepository } from '../../repositories/sandbox.repository';
import { sanitizeSandboxError } from '../../utils/sanitize-error.util';
import { BackupState } from '../../volume/enums/backup-state.enum';

type BackupStateChange = Readonly<{
	backupSnapshot?: string | null;
	backupRegistryId?: string | null;
	backupErrorReason?: string | null;
	recoverable?: boolean;
}>;

@Injectable()
export class SandboxBackupStateService {
	private readonly logger = new Logger(SandboxBackupStateService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly sandboxRepository: SandboxRepository,
		private readonly machineService: MachineService
	) {}

	async update(
		sandboxId: string,
		backupState: BackupState,
		change: BackupStateChange = {}
	): Promise<void> {
		const sandbox = await this.entityManager.findOneOrFail(Sandbox, {
			id: sandboxId,
		});

		const updateData = Sandbox.getBackupStateUpdate(
			sandbox,
			backupState,
			change.backupSnapshot,
			change.backupRegistryId,
			change.backupErrorReason,
			change.recoverable
		);

		await this.sandboxRepository.update(sandboxId, {
			updateData,
			entity: sandbox,
		});
	}

	async recordFailure(sandbox: Sandbox, error: unknown): Promise<void> {
		const { recoverable, errorReason } = sanitizeSandboxError(error);
		const isArchiveFlow = sandbox.desiredState === SandboxDesiredState.ARCHIVED;
		const isOnDrainingMachine = await this.machineIsDraining(sandbox);
		await this.update(sandbox.id, BackupState.ERROR, {
			backupErrorReason: errorReason,
			recoverable: recoverable && (isArchiveFlow || isOnDrainingMachine),
		});
		if (isOnDrainingMachine && recoverable) {
			await this.markSandboxErrored(sandbox, errorReason);
		}
	}

	async markInProgressIfPending(sandboxId: string): Promise<void> {
		try {
			await this.sandboxRepository.updateWhere(sandboxId, {
				updateData: { backupState: BackupState.IN_PROGRESS },
				whereCondition: { backupState: BackupState.PENDING },
			});
		} catch (error) {
			if (!(error instanceof SandboxConflictException)) throw error;
			this.logger.debug(
				`Skipping InProgress transition for sandbox ${sandboxId}: backup no longer PENDING`
			);
		}
	}

	private async machineIsDraining(sandbox: Sandbox): Promise<boolean> {
		if (!sandbox.machineId) return false;
		const machine = await this.machineService.findOne(sandbox.machineId);
		return machine?.draining === true;
	}

	private async markSandboxErrored(
		sandbox: Sandbox,
		errorReason: string | null
	): Promise<void> {
		if (sandbox.state === SandboxState.ERROR) return;
		await this.sandboxRepository.updateWhere(sandbox.id, {
			updateData: { state: SandboxState.ERROR, errorReason },
			whereCondition: { state: sandbox.state },
		});
	}
}
