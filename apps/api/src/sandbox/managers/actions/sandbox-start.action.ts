/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { BillingRestrictedException } from '../../../billing/exceptions/billing-restricted.exception';
import { MILLISECONDS_PER_MINUTE } from '../../../common/constants/time.constants';
import { errorMessage } from '../../../common/utils/error/error.util';
import { millisecondsBetween } from '../../../common/utils/time.util';
import { CONVERGENCE_TIMEOUT_MINUTES } from '../../../machine/constants/machine-desired-state.constants';
import { MACHINE_RELIABILITY_EVENT_KIND } from '../../../machine/constants/machine-reliability.constants';
import { Machine } from '../../../machine/entities/machine.entity';
import { MachineState } from '../../../machine/enums/machine-state.enum';
import { MachineService } from '../../../machine/services/machine.service';
import { MachinePlatformObservationService } from '../../../machine/services/machine-platform-observation.service';
import type { CustomerMachineParams } from '../../../machine/types/machine-scheduling.types';
import { PlacementKind } from '../../../marketplace/enums/placement-kind.enum';
import { NoAvailableMachineError } from '../../../placement/exceptions/no-available-machine.exception';
import { MachineReservationService } from '../../../placement/services/machine-reservation.service';
import { MachineSchedulingService } from '../../../placement/services/machine-scheduling.service';
import { sandboxSchedulingParameters } from '../../../placement/utils/sandbox-scheduling.util';
import { BackupState } from '../../../volume/enums/backup-state.enum';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { SandboxRepository } from '../../repositories/sandbox.repository';
import { SandboxStartWaitService } from '../../services/lifecycle/sandbox-start-wait.service';
import { SandboxActivityService } from '../../services/sandbox/sandbox-activity.service';
import { SandboxRuntimeSpecService } from '../../services/sandbox/sandbox-runtime-spec.service';
import {
	DONT_SYNC_AGAIN,
	SandboxAction,
	SYNC_AGAIN,
	SyncState,
} from './sandbox.action';
import { SandboxBuildAction } from './sandbox-build.action';
import { SandboxRestoreAction } from './sandbox-restore.action';

interface ConvergenceTimeout {
	minutes: number;
	reason: string;
}

const START_TIMEOUTS: Readonly<
	Partial<Record<SandboxState, ConvergenceTimeout>>
> = {
	[SandboxState.CREATING]: {
		minutes: CONVERGENCE_TIMEOUT_MINUTES.creating,
		reason: 'Timeout while creating sandbox',
	},
	[SandboxState.RESTORING]: {
		minutes: CONVERGENCE_TIMEOUT_MINUTES.restoring,
		reason: 'Timeout while starting sandbox',
	},
	[SandboxState.STARTING]: {
		minutes: CONVERGENCE_TIMEOUT_MINUTES.starting,
		reason: 'Timeout while starting sandbox',
	},
	[SandboxState.RESUMING]: {
		minutes: CONVERGENCE_TIMEOUT_MINUTES.resuming,
		reason: 'Timeout while resuming sandbox',
	},
};

const BUILD_STATES = new Set<SandboxState>([
	SandboxState.PENDING_BUILD,
	SandboxState.BUILDING_SNAPSHOT,
]);

function residentParameters(sandbox: Sandbox): CustomerMachineParams {
	return {
		...sandboxSchedulingParameters(sandbox),
		diskGiB: 0,
		resident: true,
	};
}

@Injectable()
export class SandboxStartAction extends SandboxAction {
	constructor(
		protected readonly machineService: MachineService,
		protected readonly sandboxRepository: SandboxRepository,
		private readonly sandboxActivityService: SandboxActivityService,
		private readonly sandboxBuildAction: SandboxBuildAction,
		private readonly sandboxRestoreAction: SandboxRestoreAction,
		private readonly runtimeSpecs: SandboxRuntimeSpecService,
		private readonly platformObservations: MachinePlatformObservationService,
		private readonly machineScheduling: MachineSchedulingService,
		private readonly machineReservations: MachineReservationService,
		private readonly startWaits: SandboxStartWaitService,
		private readonly entityManager: EntityManager
	) {
		super(machineService, sandboxRepository);
	}

	async run(sandbox: Sandbox): Promise<SyncState> {
		if (
			sandbox.snapshot === null &&
			(BUILD_STATES.has(sandbox.state) ||
				sandbox.state === SandboxState.UNKNOWN)
		) {
			await this.loadBuildInfo(sandbox);
		}

		if (BUILD_STATES.has(sandbox.state)) {
			return this.sandboxBuildAction.run(sandbox);
		}

		switch (sandbox.state) {
			case SandboxState.UNKNOWN:
				return this.createOnAssignedMachine(sandbox);
			case SandboxState.PENDING_PLACEMENT:
				return this.placePending(sandbox);
			case SandboxState.STOPPED:
				return sandbox.awaitsAutomaticRestart()
					? DONT_SYNC_AGAIN
					: this.startStopped(sandbox);
			case SandboxState.ARCHIVED:
			case SandboxState.ARCHIVING:
				return this.startStopped(sandbox);
			case SandboxState.PAUSED:
				return sandbox.pausedForPayment
					? DONT_SYNC_AGAIN
					: this.resumePaused(sandbox);
			case SandboxState.RESTORING:
			case SandboxState.CREATING:
			case SandboxState.STARTING:
			case SandboxState.RESUMING:
				return this.failIfTimedOut(sandbox);
			default:
				return DONT_SYNC_AGAIN;
		}
	}

	private async loadBuildInfo(sandbox: Sandbox): Promise<void> {
		const result = await this.entityManager.findOne(
			Sandbox,
			{ id: sandbox.id },
			{ populate: ['buildInfo'], refresh: true }
		);
		sandbox.buildInfo = result?.buildInfo;
	}

	private async createOnAssignedMachine(sandbox: Sandbox): Promise<SyncState> {
		if (!(await this.assignedMachineIsReady(sandbox))) {
			return DONT_SYNC_AGAIN;
		}
		await this.updateSandboxState(
			sandbox,
			{ state: SandboxState.CREATING },
			{
				runtimeIntent: (machineId) =>
					this.runtimeSpecs.imageIntent(sandbox, machineId),
			}
		);
		return SYNC_AGAIN;
	}

	private async placePending(sandbox: Sandbox): Promise<SyncState> {
		try {
			await this.updateSandboxState(
				sandbox,
				{ state: SandboxState.CREATING },
				{
					reserveMachine: (manager, coLockedMachineIds) =>
						this.machineReservations.reserve(
							manager,
							sandboxSchedulingParameters(sandbox),
							coLockedMachineIds
						),
					runtimeIntent: (machineId) =>
						this.runtimeSpecs.imageIntent(sandbox, machineId),
				}
			);
		} catch (error) {
			if (error instanceof BillingRestrictedException) {
				await this.startWaits.failPendingPlacement(
					sandbox,
					errorMessage(error)
				);
				return DONT_SYNC_AGAIN;
			}
			if (error instanceof NoAvailableMachineError) return DONT_SYNC_AGAIN;
			throw error;
		}
		return SYNC_AGAIN;
	}

	private async startStopped(sandbox: Sandbox): Promise<SyncState> {
		if (!sandbox.machineId || sandbox.state === SandboxState.ARCHIVING) {
			return this.sandboxRestoreAction.run(sandbox);
		}

		const machine = await this.machineService.findOneOrFail(sandbox.machineId);
		if (sandbox.placementKind === PlacementKind.PINNED) {
			if (sandbox.machineId !== sandbox.pinnedMachineId) {
				return this.sandboxRestoreAction.run(sandbox);
			}
		} else if (
			sandbox.backupState === BackupState.COMPLETED &&
			(await this.shouldMoveToAnotherMachine(sandbox, machine))
		) {
			return this.sandboxRestoreAction.run(sandbox);
		}
		if (machine.state !== MachineState.READY) {
			return DONT_SYNC_AGAIN;
		}
		return this.startOnAssignedMachine(sandbox, machine.id);
	}

	private async startOnAssignedMachine(
		sandbox: Sandbox,
		machineId: string
	): Promise<SyncState> {
		const parameters = residentParameters(sandbox);
		try {
			await this.updateSandboxState(
				sandbox,
				{ state: SandboxState.STARTING },
				{
					reserveMachine: async (manager, coLockedMachineIds) => {
						const reserved = await this.machineReservations.reserveSpecific(
							manager,
							machineId,
							parameters,
							coLockedMachineIds.filter((id) => id !== machineId)
						);
						if (!reserved) throw new NoAvailableMachineError(parameters);
						return reserved;
					},
					runtimeIntent: () => this.runtimeSpecs.startedIntent(sandbox),
				}
			);
		} catch (error) {
			if (error instanceof BillingRestrictedException) {
				await this.startWaits.withdraw(sandbox);
				return DONT_SYNC_AGAIN;
			}
			if (error instanceof NoAvailableMachineError) return DONT_SYNC_AGAIN;
			throw error;
		}
		return SYNC_AGAIN;
	}

	private async machineTakesSandbox(
		sandbox: Sandbox,
		machine: Machine
	): Promise<boolean> {
		if (
			machine.unschedulable ||
			machine.state !== MachineState.READY ||
			!(await this.machineScheduling.machineIsEligible(machine.id))
		) {
			return false;
		}
		return this.machineScheduling.machineAccepts(
			machine.id,
			residentParameters(sandbox)
		);
	}

	private async shouldMoveToAnotherMachine(
		sandbox: Sandbox,
		machine: Machine
	): Promise<boolean> {
		if (await this.machineTakesSandbox(sandbox, machine)) {
			return false;
		}
		const parameters = sandboxSchedulingParameters(sandbox);
		const alternative = await this.machineScheduling.findBestMachine({
			...parameters,
			excludedMachineIds: [machine.id],
		});
		return alternative !== null;
	}

	private async resumePaused(sandbox: Sandbox): Promise<SyncState> {
		if (!(await this.assignedMachineIsReady(sandbox))) {
			return DONT_SYNC_AGAIN;
		}
		await this.updateSandboxState(
			sandbox,
			{ state: SandboxState.RESUMING },
			{ runtimeIntent: () => this.runtimeSpecs.startedIntent(sandbox) }
		);
		return SYNC_AGAIN;
	}

	private async assignedMachineIsReady(sandbox: Sandbox): Promise<boolean> {
		if (!sandbox.machineId) {
			throw new Error(`Sandbox ${sandbox.id} has no assigned machine`);
		}
		const machine = await this.machineService.findOneOrFail(sandbox.machineId);
		return machine.state === MachineState.READY;
	}

	private async failIfTimedOut(sandbox: Sandbox): Promise<SyncState> {
		const timeout = START_TIMEOUTS[sandbox.state];
		if (!timeout) return DONT_SYNC_AGAIN;
		const lastActivityAt = await this.sandboxActivityService.getLastActivityAt(
			sandbox.id
		);
		if (
			!lastActivityAt ||
			millisecondsBetween(lastActivityAt, new Date()) <=
				timeout.minutes * MILLISECONDS_PER_MINUTE
		) {
			return DONT_SYNC_AGAIN;
		}
		if (sandbox.machineId) {
			await this.platformObservations.observeSandbox(
				MACHINE_RELIABILITY_EVENT_KIND.CONVERGENCE_DEADLINE_MISSED,
				sandbox.id,
				sandbox.machineId
			);
		}
		await this.updateSandboxState(sandbox, {
			state: SandboxState.ERROR,
			errorReason: timeout.reason,
			recoverable: false,
		});
		return DONT_SYNC_AGAIN;
	}
}
