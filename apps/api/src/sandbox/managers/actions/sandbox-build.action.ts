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
import { millisecondsBetween } from '../../../common/utils/time.util';
import { DockerRegistryService } from '../../../docker-registry/services/docker-registry.service';
import { recordOperationDuration } from '../../../infra/logging/utils/operation-observability.util';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { Machine } from '../../machine/entities/machine.entity';
import { MachineSnapshotTargetReason } from '../../machine/enums/machine-snapshot-target-reason.enum';
import { MachineState } from '../../machine/enums/machine-state.enum';
import { MachineSnapshotTargetService } from '../../machine/services/desired-state/machine-snapshot-target.service';
import { MachineService } from '../../machine/services/machine.service';
import type { CustomerMachineParams } from '../../machine/types/machine-scheduling.types';
import { sandboxTemplatePreparation } from '../../machine/utils/proto/snapshot-template.util';
import { JobConflictException } from '../../machine-job/exceptions/job-conflict.exception';
import { MachineJobDispatchService } from '../../machine-job/services/machine-job-dispatch.service';
import { NoAvailableMachineError } from '../../placement/exceptions/no-available-machine.exception';
import { MachineReservationService } from '../../placement/services/machine-reservation.service';
import { MachineSchedulingService } from '../../placement/services/machine-scheduling.service';
import { machineSatisfiesGpuRequest } from '../../placement/utils/machine-gpu-compatibility.util';
import { sandboxSchedulingParameters } from '../../placement/utils/sandbox-scheduling.util';
import { SandboxRepository } from '../../repositories/sandbox.repository';
import { BuildInfo } from '../../snapshot/entities/build-info.entity';
import { SnapshotBuildProgressService } from '../../snapshot/services/snapshot-build-progress.service';
import {
	DONT_SYNC_AGAIN,
	SandboxAction,
	SYNC_AGAIN,
	SyncState,
} from './sandbox.action';

const BUILD_FAILURE_REASON = 'Failed to build snapshot on machine';
const BUILD_HANDOFF_DELAY_OPERATION = 'snapshot.build.handoff_delay';

@Injectable()
export class SandboxBuildAction extends SandboxAction {
	constructor(
		protected readonly machineService: MachineService,
		protected readonly sandboxRepository: SandboxRepository,
		private readonly entityManager: EntityManager,
		private readonly machineReservations: MachineReservationService,
		private readonly machineJobDispatch: MachineJobDispatchService,
		private readonly dockerRegistryService: DockerRegistryService,
		private readonly targets: MachineSnapshotTargetService,
		private readonly builds: SnapshotBuildProgressService,
		private readonly machineScheduling: MachineSchedulingService
	) {
		super(machineService, sandboxRepository);
	}

	async run(sandbox: Sandbox): Promise<SyncState> {
		const buildInfo = sandbox.buildInfo;
		if (!buildInfo) {
			throw new Error(
				`Sandbox ${sandbox.id} in state ${sandbox.state} has no build information`
			);
		}
		return sandbox.machineId
			? this.awaitBuildOnMachine(
					sandbox,
					buildInfo.snapshotRef,
					sandbox.machineId
				)
			: this.assignMachine(sandbox, buildInfo);
	}

	private async awaitBuildOnMachine(
		sandbox: Sandbox,
		ref: string,
		machineId: string
	): Promise<SyncState> {
		const progress = await this.builds.progressOn(
			machineId,
			ref,
			sandbox.createdAt
		);
		switch (progress.kind) {
			case 'held':
				await this.updateSandboxState(sandbox, { state: SandboxState.UNKNOWN });
				if (progress.builtAt) {
					recordOperationDuration(
						BUILD_HANDOFF_DELAY_OPERATION,
						Math.max(0, millisecondsBetween(progress.builtAt, new Date())),
						{}
					);
				}
				return SYNC_AGAIN;
			case 'failed':
				await this.updateSandboxState(sandbox, {
					state: SandboxState.BUILD_FAILED,
					errorReason: progress.errorReason ?? BUILD_FAILURE_REASON,
				});
				return DONT_SYNC_AGAIN;
			case 'building':
				return DONT_SYNC_AGAIN;
			default:
				await this.updateSandboxState(sandbox, {
					state: SandboxState.PENDING_BUILD,
					machineId: null,
				});
				return SYNC_AGAIN;
		}
	}

	private async assignMachine(
		sandbox: Sandbox,
		buildInfo: BuildInfo
	): Promise<SyncState> {
		const ref = buildInfo.snapshotRef;
		const parameters = sandboxSchedulingParameters(sandbox);
		const holder = await this.machineScheduling.findBestMachine({
			...parameters,
			snapshotRef: ref,
			snapshotRequired: true,
		});
		if (holder) {
			return this.placeOnMachine(
				sandbox,
				SandboxState.UNKNOWN,
				holder.id,
				parameters
			);
		}
		const failure = await this.builds.failureSince(ref, sandbox.createdAt);
		if (failure) {
			await this.updateSandboxState(sandbox, {
				state: SandboxState.BUILD_FAILED,
				errorReason: failure.errorReason ?? BUILD_FAILURE_REASON,
			});
			return DONT_SYNC_AGAIN;
		}
		const builder = await this.machineBuilding(ref, sandbox, parameters);
		if (builder) {
			return this.placeOnMachine(
				sandbox,
				SandboxState.BUILDING_SNAPSHOT,
				builder,
				parameters
			);
		}
		return this.buildOnNewMachine(sandbox, buildInfo, parameters);
	}

	private async buildOnNewMachine(
		sandbox: Sandbox,
		buildInfo: BuildInfo,
		parameters: CustomerMachineParams
	): Promise<SyncState> {
		const machine = await this.machineScheduling.findBestMachine(parameters);
		if (!machine) {
			return DONT_SYNC_AGAIN;
		}
		await this.entityManager.transactional((manager) =>
			this.targets.add(
				manager,
				machine.id,
				buildInfo.snapshotRef,
				MachineSnapshotTargetReason.BUILD_CACHE,
				sandboxTemplatePreparation(sandbox)
			)
		);
		await this.dispatchBuild(sandbox, buildInfo, machine);
		return this.placeOnMachine(
			sandbox,
			SandboxState.BUILDING_SNAPSHOT,
			machine.id,
			parameters
		);
	}

	private async dispatchBuild(
		sandbox: Sandbox,
		buildInfo: BuildInfo,
		machine: Machine
	): Promise<void> {
		if (!buildInfo.dockerfileContent) {
			throw new Error(
				`Build ${buildInfo.snapshotRef} has no Dockerfile content`
			);
		}
		const sourceRegistries =
			await this.dockerRegistryService.getSourceRegistriesForDockerfile(
				buildInfo.dockerfileContent,
				sandbox.organizationId
			);
		const cacheRegistry = this.dockerRegistryService.getBuildCacheRegistry(
			sandbox.organizationId
		);
		try {
			await this.machineJobDispatch.buildSnapshot(
				machine,
				buildInfo,
				sandbox.organizationId,
				cacheRegistry,
				sourceRegistries.length > 0 ? sourceRegistries : undefined
			);
		} catch (error) {
			if (!(error instanceof JobConflictException)) throw error;
		}
	}

	private async machineBuilding(
		ref: string,
		sandbox: Sandbox,
		parameters: CustomerMachineParams
	): Promise<string | null> {
		const machineIds = await this.builds.machinesBuilding(ref);
		const machines = await this.machineService.findByIds(machineIds);
		const excluded = new Set(parameters.excludedMachineIds);
		const builder = machines.find(
			(machine) =>
				machine.sandboxClass === sandbox.sandboxClass &&
				machineSatisfiesGpuRequest(machine, parameters) &&
				!machine.unschedulable &&
				!machine.draining &&
				machine.state === MachineState.READY &&
				!excluded.has(machine.id)
		);
		return builder?.id ?? null;
	}

	private async placeOnMachine(
		sandbox: Sandbox,
		state: SandboxState,
		machineId: string,
		parameters: CustomerMachineParams
	): Promise<SyncState> {
		try {
			await this.updateSandboxState(
				sandbox,
				{ state },
				{
					reserveMachine: async (manager, coLockedMachineIds) => {
						const reserved = await this.machineReservations.reserveSpecific(
							manager,
							machineId,
							parameters,
							coLockedMachineIds
						);
						if (!reserved) {
							throw new NoAvailableMachineError();
						}
						return reserved;
					},
				}
			);
		} catch (error) {
			if (error instanceof NoAvailableMachineError) {
				return DONT_SYNC_AGAIN;
			}
			throw error;
		}
		return SYNC_AGAIN;
	}
}
