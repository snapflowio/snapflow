/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, NotFoundException } from '@nestjs/common';
import { SandboxLifecycle } from '@snapflow/machine-proto';
import { BillingRestrictedException } from '../../../../billing/ledger/exceptions/billing-restricted.exception';
import { LeaseEndReason } from '../../../../marketplace/machine/enums/lease-end-reason.enum';
import { PlacementKind } from '../../../../marketplace/machine/enums/placement-kind.enum';
import { MachineService } from '../../../machine/services/machine.service';
import type { CustomerMachineParams } from '../../../machine/types/machine-scheduling.types';
import { MachineUnavailableException } from '../../../placement/exceptions/machine-unavailable.exception';
import { NoAvailableMachineError } from '../../../placement/exceptions/no-available-machine.exception';
import {
	MachineReservationService,
	type ReservedMachine,
} from '../../../placement/services/machine-reservation.service';
import { sandboxSchedulingParameters } from '../../../placement/utils/sandbox-scheduling.util';
import { SnapshotService } from '../../../snapshot/services/snapshot.service';
import { BackupState } from '../../../volume/enums/backup-state.enum';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { SandboxRepository } from '../../repositories/sandbox.repository';
import { SandboxRuntimeSpecService } from '../../services/sandbox/sandbox-runtime-spec.service';
import { DONT_SYNC_AGAIN, SandboxAction, SyncState } from './sandbox.action';

const MISSING_BACKUP_REASON =
	'Sandbox has no usable machine and no completed backup to restore from';

@Injectable()
export class SandboxRestoreAction extends SandboxAction {
	constructor(
		protected readonly machineService: MachineService,
		protected readonly sandboxRepository: SandboxRepository,
		private readonly machineReservations: MachineReservationService,
		private readonly snapshotService: SnapshotService,
		private readonly runtimeSpecs: SandboxRuntimeSpecService
	) {
		super(machineService, sandboxRepository);
	}

	async run(sandbox: Sandbox): Promise<SyncState> {
		if (
			sandbox.backupState !== BackupState.COMPLETED ||
			!sandbox.backupSnapshot
		) {
			await this.updateSandboxState(sandbox, {
				state: SandboxState.ERROR,
				errorReason: MISSING_BACKUP_REASON,
			});
			return DONT_SYNC_AGAIN;
		}

		const previousMachineId =
			sandbox.machineId ?? sandbox.prevMachineId ?? null;
		const parameters = sandboxSchedulingParameters(sandbox);
		const moved =
			sandbox.placementKind === PlacementKind.PINNED &&
			sandbox.machineId !== null &&
			sandbox.machineId !== sandbox.pinnedMachineId;
		const baseSnapshotRef = await this.baseSnapshotRef(sandbox);

		try {
			await this.updateSandboxState(
				sandbox,
				{ state: SandboxState.RESTORING, prevMachineId: previousMachineId },
				{
					reserveMachine: (manager, coLockedMachineIds) =>
						this.reserveMachine(
							manager,
							parameters,
							baseSnapshotRef,
							coLockedMachineIds
						),
					runtimeIntent: (machineId) =>
						this.runtimeSpecs.backupIntent(
							sandbox,
							machineId,
							SandboxLifecycle.STARTED
						),
					leaseEndReason: moved ? LeaseEndReason.MOVED : undefined,
				}
			);
		} catch (error) {
			if (
				error instanceof NoAvailableMachineError ||
				error instanceof MachineUnavailableException ||
				error instanceof BillingRestrictedException
			) {
				return DONT_SYNC_AGAIN;
			}
			throw error;
		}
		return DONT_SYNC_AGAIN;
	}

	private reserveMachine(
		manager: EntityManager,
		parameters: CustomerMachineParams,
		baseSnapshotRef: string | null,
		coLockedMachineIds: readonly string[]
	): Promise<ReservedMachine> {
		return this.machineReservations.reserve(
			manager,
			baseSnapshotRef
				? { ...parameters, snapshotRef: baseSnapshotRef }
				: parameters,
			coLockedMachineIds
		);
	}

	private async baseSnapshotRef(sandbox: Sandbox): Promise<string | null> {
		if (!sandbox.snapshot) {
			return null;
		}
		try {
			const snapshot = await this.snapshotService.getSnapshotByName(
				sandbox.snapshot,
				sandbox.organizationId
			);
			return snapshot.ref ?? null;
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}
			throw error;
		}
	}
}
