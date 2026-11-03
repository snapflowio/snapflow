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
import { EventEmitter2 } from '@nestjs/event-emitter';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import type { MachineSession } from '../../machine/entities/machine-session.entity';
import { MachineSessionService } from '../../machine/services/machine-session.service';
import { decodeSnapshotInventory } from '../../machine/utils/desired-state/machine-snapshot-inventory.util';
import { SnapshotMachine } from '../entities/snapshot-machine.entity';
import { SnapshotMachineState } from '../enums/snapshot-machine-state.enum';
import {
	publishSnapshotBuildSettled,
	SnapshotBuildSettledEvent,
} from '../events/snapshot-build-settled.event';
import { SnapshotActivationService } from './snapshot-activation.service';
import { SnapshotPrewarmService } from './snapshot-prewarm.service';

@Injectable()
export class MachineSnapshotInventoryService {
	private readonly logger = new Logger(MachineSnapshotInventoryService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly machineSessions: MachineSessionService,
		private readonly activation: SnapshotActivationService,
		private readonly prewarm: SnapshotPrewarmService,
		private readonly eventEmitter: EventEmitter2
	) {}

	async report(
		machineId: string,
		session: MachineSession,
		encodedInventory: string
	): Promise<void> {
		const snapshots = decodeSnapshotInventory(encodedInventory);
		const heldRefs = snapshots
			.filter(({ state }) => state === SnapshotMachineState.PRESENT)
			.map(({ snapshotRef }) => snapshotRef);
		const stored = await this.entityManager.transactional(async (manager) => {
			const observedAt = await databaseNow(manager);
			const machine = await this.machineSessions.assertCurrent(
				manager,
				machineId,
				session.id,
				observedAt
			);
			const previouslyHeld = await manager.find(
				SnapshotMachine,
				{ machineId, state: SnapshotMachineState.PRESENT },
				{ fields: ['snapshotRef'] }
			);
			if (snapshots.length === 0) {
				await manager.nativeDelete(SnapshotMachine, { machineId });
			} else {
				await manager.nativeDelete(SnapshotMachine, {
					machineId,
					snapshotRef: {
						$nin: snapshots.map(({ snapshotRef }) => snapshotRef),
					},
				});
				await manager.upsertMany(
					SnapshotMachine,
					snapshots.map((snapshot) => ({ ...snapshot, machineId, observedAt })),
					{ onConflictFields: ['machineId', 'snapshotRef'] }
				);
			}
			const held = new Set(
				previouslyHeld.map(({ snapshotRef }) => snapshotRef)
			);
			return {
				machine,
				observedAt,
				newlyHeldRefs: heldRefs.filter((ref) => !held.has(ref)),
			};
		});
		await this.activation.activateHeldBy(stored.machine, heldRefs);
		if (stored.newlyHeldRefs.length === 0) return;
		await this.prewarm.recordHeld(
			machineId,
			stored.newlyHeldRefs,
			stored.observedAt
		);
		publishSnapshotBuildSettled(
			this.eventEmitter,
			this.logger,
			new SnapshotBuildSettledEvent(machineId, stored.newlyHeldRefs)
		);
	}
}
