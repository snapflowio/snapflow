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
import { SandboxLifecycle } from '@snapflow/machine-proto';
import { MILLISECONDS_PER_MINUTE } from '../../../common/constants/time.constants';
import { millisecondsBetween } from '../../../common/utils/time.util';
import { CONVERGENCE_TIMEOUT_MINUTES } from '../../../machine/constants/machine-desired-state.constants';
import { MACHINE_RELIABILITY_EVENT_KIND } from '../../../machine/constants/machine-reliability.constants';
import { Machine } from '../../../machine/entities/machine.entity';
import { MachineState } from '../../../machine/enums/machine-state.enum';
import { MachineService } from '../../../machine/services/machine.service';
import { MachinePlatformObservationService } from '../../../machine/services/machine-platform-observation.service';
import { PlacementKind } from '../../../marketplace/enums/placement-kind.enum';
import { MachineSchedulingService } from '../../../placement/services/machine-scheduling.service';
import { sandboxSchedulingParameters } from '../../../placement/utils/sandbox-scheduling.util';
import { BackupState } from '../../../volume/enums/backup-state.enum';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { SandboxRepository } from '../../repositories/sandbox.repository';
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

const STARTED_INTENT = { lifecycle: SandboxLifecycle.STARTED } as const;

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
			case SandboxState.ARCHIVED:
			case SandboxState.ARCHIVING:
			case SandboxState.STOPPED:
				return this.startStopped(sandbox);
			case SandboxState.PAUSED:
				return this.resumePaused(sandbox);
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

	private async startStopped(sandbox: Sandbox): Promise<SyncState> {
		if (!sandbox.machineId || sandbox.state === SandboxState.ARCHIVING) {
			return this.sandboxRestoreAction.run(sandbox);
		}

		const machine = await this.machineService.findOneOrFail(sandbox.machineId);
		if (sandbox.placementKind === PlacementKind.PINNED) {
			if (sandbox.machineId !== sandbox.pinnedMachineId) {
				return this.sandboxRestoreAction.run(sandbox);
			}
			if (!(await this.machineTakesSandbox(sandbox, machine))) {
				return DONT_SYNC_AGAIN;
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

		await this.updateSandboxState(
			sandbox,
			{ state: SandboxState.STARTING },
			{ runtimeIntent: STARTED_INTENT }
		);
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
		return this.machineScheduling.machineAccepts(machine.id, {
			...sandboxSchedulingParameters(sandbox),
			diskGiB: 0,
		});
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
			{ runtimeIntent: STARTED_INTENT }
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
