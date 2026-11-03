/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { QueryOrder } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { millisecondsBetween } from '../../../common/utils/time.util';
import { recordOperationDuration } from '../../../infra/logging/utils/operation-observability.util';
import { Machine } from '../../machine/entities/machine.entity';
import { MachineSnapshotTargetReason } from '../../machine/enums/machine-snapshot-target-reason.enum';
import { MachineSnapshotTargetService } from '../../machine/services/desired-state/machine-snapshot-target.service';
import { snapshotTemplatePreparation } from '../../machine/utils/proto/snapshot-template.util';
import { Job } from '../../machine-job/entities/job.entity';
import { JobStatus } from '../../machine-job/enums/job-status.enum';
import { JobType } from '../../machine-job/enums/job-type.enum';
import { Snapshot } from '../entities/snapshot.entity';
import { SnapshotMachine } from '../entities/snapshot-machine.entity';
import { SnapshotMachineState } from '../enums/snapshot-machine-state.enum';
import { SnapshotState } from '../enums/snapshot-state.enum';
import { SnapshotRepository } from '../repositories/snapshot.repository';

const ACTIVATABLE_STATES = [SnapshotState.PULLING, SnapshotState.BUILDING];
const PUBLICATION_JOB_TYPES = [
	JobType.BUILD_SNAPSHOT,
	JobType.PUBLISH_SNAPSHOT,
];
const ACTIVATION_DELAY_OPERATION = 'snapshot.activation.delay';

@Injectable()
export class SnapshotActivationService {
	private readonly logger = new Logger(SnapshotActivationService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly snapshotRepository: SnapshotRepository,
		private readonly targets: MachineSnapshotTargetService
	) {}

	async activateHeldBy(
		machine: Machine,
		heldRefs: readonly string[]
	): Promise<void> {
		if (heldRefs.length === 0) return;
		const snapshots = await this.entityManager.find(Snapshot, {
			ref: { $in: [...heldRefs] },
			state: { $in: ACTIVATABLE_STATES },
		});
		for (const snapshot of snapshots) {
			await this.activateOn(snapshot, machine);
		}
	}

	async activateIfHeld(snapshot: Snapshot): Promise<void> {
		if (!snapshot.ref) return;
		const holders = await this.entityManager.find(SnapshotMachine, {
			snapshotRef: snapshot.ref,
			state: SnapshotMachineState.PRESENT,
		});
		const machines = await this.entityManager.find(Machine, {
			id: { $in: holders.map(({ machineId }) => machineId) },
		});
		for (const machine of machines) {
			if (await this.activateOn(snapshot, machine)) return;
		}
	}

	private async activateOn(
		snapshot: Snapshot,
		machine: Machine
	): Promise<boolean> {
		if (
			snapshot.size == null ||
			!snapshot.ref ||
			!ACTIVATABLE_STATES.includes(snapshot.state)
		) {
			return false;
		}
		const ref = snapshot.ref;
		const activatedAt = new Date();
		await this.snapshotRepository.update(snapshot.id, {
			updateData: {
				state: SnapshotState.ACTIVE,
				errorReason: null,
				lastUsedAt: activatedAt,
			},
			entity: snapshot,
		});
		await this.entityManager.transactional((manager) =>
			this.targets.add(
				manager,
				machine.id,
				ref,
				MachineSnapshotTargetReason.PROPAGATION,
				snapshotTemplatePreparation(snapshot)
			)
		);
		this.logger.log(
			`Snapshot ${snapshot.id} is active: machine ${machine.id} holds ${ref}`
		);
		await this.recordActivationDelay(snapshot, ref, activatedAt);
		return true;
	}

	private async recordActivationDelay(
		snapshot: Snapshot,
		ref: string,
		activatedAt: Date
	): Promise<void> {
		if (!snapshot.initialMachineId) return;
		const job = await this.entityManager.findOne(
			Job,
			{
				machineId: snapshot.initialMachineId,
				type: { $in: PUBLICATION_JOB_TYPES },
				resourceId: snapshot.buildInfo?.snapshotRef ?? ref,
				status: JobStatus.COMPLETED,
			},
			{ orderBy: { completedAt: QueryOrder.DESC } }
		);
		if (!job?.completedAt) return;
		recordOperationDuration(
			ACTIVATION_DELAY_OPERATION,
			Math.max(0, millisecondsBetween(job.completedAt, activatedAt)),
			{ 'job.type': job.type }
		);
	}
}
