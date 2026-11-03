/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { RequestContext } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { errorMessage } from '../../../../common/utils/error/error.util';
import { addMilliseconds } from '../../../../common/utils/time.util';
import { ResourceShape } from '../../../../common/values/resource-shape.value';
import { databaseNow } from '../../../../infra/database/utils/database-time.util';
import { PlacementKind } from '../../../../marketplace/machine/enums/placement-kind.enum';
import { UNOBSERVED_CREATE_REASSIGNMENT } from '../../../machine/constants/machine-desired-state.constants';
import { MACHINE_RELIABILITY_EVENT_KIND } from '../../../machine/constants/machine-reliability.constants';
import { Machine } from '../../../machine/entities/machine.entity';
import { MachineState } from '../../../machine/enums/machine-state.enum';
import { MachinePlatformObservationService } from '../../../machine/services/machine-platform-observation.service';
import type { CustomerMachineParams } from '../../../machine/types/machine-scheduling.types';
import { lockMachinesForUpdate } from '../../../machine/utils/machine-lock.util';
import { machineWorkloadFingerprint } from '../../../machine/utils/machine-workload-fingerprint.util';
import { decodeSandboxSpec } from '../../../machine/utils/proto/sandbox-runtime-spec.util';
import { NoAvailableMachineError } from '../../../placement/exceptions/no-available-machine.exception';
import { MachineReservationService } from '../../../placement/services/machine-reservation.service';
import { MachineSchedulingService } from '../../../placement/services/machine-scheduling.service';
import { placementRequest } from '../../../placement/utils/sandbox-placement.util';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxPlacement } from '../../entities/sandbox-placement.entity';
import { SandboxDesiredState } from '../../enums/sandbox-desired-state.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { SandboxRepository } from '../../repositories/sandbox.repository';

const PINNED_CREATE_UNOBSERVED_REASON =
	'The pinned machine did not report the sandbox create';

const CANDIDATES_SQL = `
SELECT sandbox.id
FROM sandbox
INNER JOIN machine ON machine.id = sandbox."machineId"
INNER JOIN sandbox_placement placement
	ON placement."sandboxId" = sandbox.id AND placement."releasedAt" IS NULL
LEFT JOIN sandbox_observed_status observed
	ON observed."sandboxId" = sandbox.id
	AND observed."assignmentGeneration" = placement."assignmentGeneration"
WHERE sandbox.state = ?
	AND sandbox."desiredState" = ?
	AND sandbox.pending = true
	AND sandbox.gpu = 0
	AND sandbox.volumes = '[]'::jsonb
	AND sandbox."linkedSandboxId" IS NULL
	AND sandbox."updatedAt" <= ?
	AND observed."sandboxId" IS NULL
	AND NOT EXISTS (SELECT 1 FROM sandbox_fork fork WHERE fork."childId" = sandbox.id)
	AND (machine.state <> ? OR machine."sessionExpiresAt" IS NULL OR machine."sessionExpiresAt" <= ?)
ORDER BY sandbox."updatedAt" ASC, sandbox.id ASC
LIMIT ?`;

function machineIsLive(machine: Machine | null, now: Date): boolean {
	return (
		machine?.state === MachineState.READY &&
		machine.sessionExpiresAt !== null &&
		machine.sessionExpiresAt > now
	);
}

@Injectable()
export class UnobservedCreateReassignmentService {
	private readonly logger = new Logger(
		UnobservedCreateReassignmentService.name
	);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly sandboxRepository: SandboxRepository,
		private readonly machines: MachineSchedulingService,
		private readonly reservations: MachineReservationService,
		private readonly platformObservations: MachinePlatformObservationService
	) {}

	async reassignDue(): Promise<void> {
		await RequestContext.create(this.entityManager, () =>
			this.reassignDueInContext()
		);
	}

	private async reassignDueInContext(): Promise<void> {
		const now = await databaseNow(this.entityManager);
		const rows = await this.entityManager.execute<{ id: string }[]>(
			CANDIDATES_SQL,
			[
				SandboxState.CREATING,
				SandboxDesiredState.STARTED,
				addMilliseconds(now, -UNOBSERVED_CREATE_REASSIGNMENT.graceMilliseconds),
				MachineState.READY,
				now,
				UNOBSERVED_CREATE_REASSIGNMENT.batchSize,
			]
		);
		for (const { id } of rows) {
			try {
				await this.reassign(id);
			} catch (error) {
				this.logger.warn(
					`Could not reassign the create of sandbox ${id}: ${errorMessage(error)}`
				);
			}
		}
	}

	private async reassign(sandboxId: string): Promise<void> {
		const sandbox = await this.entityManager.findOne(
			Sandbox,
			{ id: sandboxId },
			{ populate: ['runtimeSpec'] }
		);
		const oldMachineId = sandbox?.machineId;
		if (!sandbox?.runtimeSpec || !oldMachineId) return;
		const source = decodeSandboxSpec(sandbox.runtimeSpec).source;
		if (source.case !== 'image') return;
		if (sandbox.placementKind === PlacementKind.PINNED) {
			await this.sandboxRepository.update(sandbox.id, {
				entity: sandbox,
				updateData: {
					state: SandboxState.ERROR,
					errorReason: PINNED_CREATE_UNOBSERVED_REASON,
					recoverable: false,
				},
			});
			return;
		}

		const parameters = this.schedulingParameters(
			sandbox,
			source.value.ref,
			oldMachineId
		);
		const newMachine = await this.machines.findBestMachine(parameters);
		if (!newMachine) return;
		const abandoned = await this.entityManager.findOne(
			SandboxPlacement,
			{ sandboxId: sandbox.id, machineId: oldMachineId, releasedAt: null },
			{ fields: ['id'], disableIdentityMap: true }
		);

		try {
			await this.sandboxRepository.update(sandbox.id, {
				entity: sandbox,
				updateData: { prevMachineId: null },
				reserveMachine: async (manager) => {
					const machines = await lockMachinesForUpdate(manager, [
						oldMachineId,
						newMachine.id,
					]);
					const oldMachine =
						machines.find(({ id }) => id === oldMachineId) ?? null;
					if (machineIsLive(oldMachine, await databaseNow(manager))) {
						throw new NoAvailableMachineError();
					}
					const reserved = await this.reservations.reserveSpecific(
						manager,
						newMachine.id,
						parameters
					);
					if (!reserved) throw new NoAvailableMachineError();
					return reserved;
				},
			});
		} catch (error) {
			if (error instanceof NoAvailableMachineError) return;
			throw error;
		}
		if (abandoned) {
			await this.platformObservations.observePlacement(
				MACHINE_RELIABILITY_EVENT_KIND.CREATE_UNOBSERVED,
				abandoned.id
			);
		}
		this.logger.warn(
			`Reassigned the unobserved create of sandbox ${sandbox.id} from machine ${oldMachineId} to machine ${newMachine.id}`
		);
	}

	private schedulingParameters(
		sandbox: Sandbox,
		snapshotRef: string,
		excludedMachineId: string
	): CustomerMachineParams {
		return {
			customerOrganizationId: sandbox.organizationId,
			placement: placementRequest(sandbox),
			sandboxClass: sandbox.sandboxClass,
			snapshotRef,
			excludedMachineIds: [excludedMachineId],
			gpu: 0,
			cpu: sandbox.cpu,
			memoryGiB: sandbox.mem,
			diskGiB: sandbox.disk,
			gpuType: null,
			mode: sandbox.mode,
			capabilities: sandbox.capabilities,
			workloadFingerprint: machineWorkloadFingerprint({
				snapshot: sandbox.snapshot ?? null,
				sandboxClass: sandbox.sandboxClass,
				mode: sandbox.mode,
				capabilities: sandbox.capabilities,
				...ResourceShape.fromSandbox(sandbox),
			}),
		};
	}
}
