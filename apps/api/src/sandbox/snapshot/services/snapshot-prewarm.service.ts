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
import { recordOperationDuration } from '../../../infra/logging/utils/operation-observability.util';
import { SettingsService } from '../../../settings/services/settings.service';
import { Machine } from '../../machine/entities/machine.entity';
import { MachineSnapshotTarget } from '../../machine/entities/machine-snapshot-target.entity';
import { MachineSnapshotTargetReason } from '../../machine/enums/machine-snapshot-target-reason.enum';
import { MachineState } from '../../machine/enums/machine-state.enum';
import { MachineSnapshotTargetService } from '../../machine/services/desired-state/machine-snapshot-target.service';
import {
	type SnapshotTemplatePreparation,
	snapshotTemplatePreparation,
} from '../../machine/utils/proto/snapshot-template.util';
import { machineSatisfiesGpuRequest } from '../../placement/utils/machine-gpu-compatibility.util';
import { Snapshot } from '../entities/snapshot.entity';
import { SnapshotState } from '../enums/snapshot-state.enum';

const PREWARM_MACHINE_STATES: readonly MachineState[] = [
	MachineState.INITIALIZING,
	MachineState.READY,
];
const PREWARM_DELAY_OPERATION = 'snapshot.prewarm.delay';

@Injectable()
export class SnapshotPrewarmService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly targets: MachineSnapshotTargetService,
		private readonly settings: SettingsService
	) {}

	async reconcile(machineId: string): Promise<void> {
		const machine = await this.entityManager.findOneOrFail(Machine, {
			id: machineId,
		});
		const wanted = await this.wantedSnapshots(machine);
		const existing = await this.entityManager.find(MachineSnapshotTarget, {
			machineId,
			reason: MachineSnapshotTargetReason.PREWARM,
		});
		const targeted = new Set(existing.map(({ snapshotRef }) => snapshotRef));
		const stale = existing
			.filter(({ snapshotRef }) => !wanted.has(snapshotRef))
			.map(({ id }) => id);
		const missing = [...wanted].filter(([ref]) => !targeted.has(ref));
		if (stale.length === 0 && missing.length === 0) return;
		await this.entityManager.transactional(async (manager) => {
			if (stale.length > 0) {
				await this.targets.remove(manager, { id: { $in: stale } });
			}
			for (const [ref, template] of missing) {
				await this.targets.add(
					manager,
					machineId,
					ref,
					MachineSnapshotTargetReason.PREWARM,
					template
				);
			}
		});
	}

	async recordHeld(
		machineId: string,
		heldRefs: readonly string[],
		heldAt: Date
	): Promise<void> {
		if (heldRefs.length === 0) return;
		const targets = await this.entityManager.find(MachineSnapshotTarget, {
			machineId,
			reason: MachineSnapshotTargetReason.PREWARM,
			snapshotRef: { $in: [...heldRefs] },
		});
		for (const target of targets) {
			recordOperationDuration(
				PREWARM_DELAY_OPERATION,
				Math.max(0, millisecondsBetween(target.createdAt, heldAt)),
				{}
			);
		}
	}

	private async wantedSnapshots(
		machine: Machine
	): Promise<Map<string, SnapshotTemplatePreparation | null>> {
		const wanted = new Map<string, SnapshotTemplatePreparation | null>();
		if (!PREWARM_MACHINE_STATES.includes(machine.state)) return wanted;
		const builderImage = machine.runtimeCapabilities?.builderImage;
		if (builderImage) wanted.set(builderImage, null);
		const defaultSnapshot = await this.defaultSnapshot(machine);
		if (defaultSnapshot?.ref) {
			wanted.set(
				defaultSnapshot.ref,
				snapshotTemplatePreparation(defaultSnapshot)
			);
		}
		return wanted;
	}

	private async defaultSnapshot(machine: Machine): Promise<Snapshot | null> {
		const name = (await this.settings.get()).defaultSnapshot;
		if (!name) return null;
		const snapshot = await this.entityManager.findOne(Snapshot, {
			general: true,
			name,
			state: SnapshotState.ACTIVE,
			ref: { $ne: null },
		});
		if (
			!snapshot ||
			snapshot.sandboxClass !== machine.sandboxClass ||
			!machineSatisfiesGpuRequest(machine, {
				gpu: snapshot.gpu,
				gpuType: snapshot.gpuType ?? null,
			})
		) {
			return null;
		}
		return snapshot;
	}
}
