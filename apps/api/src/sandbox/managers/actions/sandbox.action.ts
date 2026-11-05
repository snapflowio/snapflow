/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable, Logger } from '@nestjs/common';
import { MachineService } from '../../../machine/services/machine.service';
import type { LeaseEndReason } from '../../../marketplace/enums/lease-end-reason.enum';
import { BackupState } from '../../../volume/enums/backup-state.enum';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxDesiredState } from '../../enums/sandbox-desired-state.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { SandboxConflictException } from '../../exceptions/sandbox-conflict.exception';
import {
	type MachineReservation,
	type RuntimeIntentSource,
	SandboxRepository,
} from '../../repositories/sandbox.repository';

export const SYNC_AGAIN = 'sync-again';
export const DONT_SYNC_AGAIN = 'dont-sync-again';
export type SyncState = typeof SYNC_AGAIN | typeof DONT_SYNC_AGAIN;

export interface SandboxStateTransition {
	state: SandboxState;
	machineId?: string | null;
	prevMachineId?: string | null;
	errorReason?: string;
	backupState?: BackupState;
	recoverable?: boolean;
}

export interface SandboxTransitionOptions {
	reserveMachine?: MachineReservation;
	runtimeIntent?: RuntimeIntentSource;
	leaseEndReason?: LeaseEndReason;
}

const ERROR_STATE_FALLBACK_REASON = 'Sandbox is in error state during update';

@Injectable()
export abstract class SandboxAction {
	protected readonly logger = new Logger(SandboxAction.name);

	constructor(
		protected readonly machineService: MachineService,
		protected readonly sandboxRepository: SandboxRepository
	) {}

	abstract run(sandbox: Sandbox): Promise<SyncState>;

	protected async updateSandboxState(
		sandbox: Sandbox,
		transition: SandboxStateTransition,
		options: SandboxTransitionOptions = {}
	): Promise<Sandbox> {
		if (
			!sandbox.pending &&
			sandbox.desiredState !== SandboxDesiredState.ARCHIVED
		) {
			this.logger.warn(
				`sandbox ${sandbox.id} is no longer pending - aborting ${transition.state} transition`
			);
			throw new SandboxConflictException();
		}

		return this.sandboxRepository.update(sandbox.id, {
			updateData: this.transitionUpdate(sandbox, transition),
			entity: sandbox,
			reserveMachine: options.reserveMachine,
			runtimeIntent: options.runtimeIntent,
			leaseEndReason: options.leaseEndReason,
		});
	}

	private transitionUpdate(
		sandbox: Sandbox,
		transition: SandboxStateTransition
	): Partial<Sandbox> {
		const updateData: Partial<Sandbox> = { state: transition.state };

		if (transition.machineId !== undefined) {
			updateData.machineId = transition.machineId;
		}
		if (transition.prevMachineId !== undefined) {
			updateData.prevMachineId = transition.prevMachineId;
		}
		if (transition.errorReason !== undefined) {
			updateData.errorReason = transition.errorReason;
			if (transition.state === SandboxState.ERROR) {
				updateData.recoverable = transition.recoverable ?? false;
			}
		}
		if (sandbox.state === SandboxState.ERROR && !sandbox.errorReason) {
			updateData.errorReason = ERROR_STATE_FALLBACK_REASON;
			updateData.recoverable = false;
		}
		if (transition.state === SandboxState.DESTROYED) {
			updateData.backupState = BackupState.NONE;
		}
		if (transition.backupState !== undefined) {
			Object.assign(
				updateData,
				Sandbox.getBackupStateUpdate(sandbox, transition.backupState)
			);
		}
		if (transition.recoverable !== undefined) {
			updateData.recoverable = transition.recoverable;
		}
		return updateData;
	}
}
