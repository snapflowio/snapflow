/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { FilterQuery } from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { Snapshot } from '../../../snapshot/entities/snapshot.entity';
import { SnapshotState } from '../../../snapshot/enums/snapshot-state.enum';
import { MachineSnapshotTarget } from '../../entities/machine-snapshot-target.entity';
import { MachineSnapshotTargetReason } from '../../enums/machine-snapshot-target-reason.enum';
import type { SnapshotTemplatePreparation } from '../../utils/proto/snapshot-template.util';
import { MachineDesiredStateRevisionService } from './machine-desired-state-revision.service';

@Injectable()
export class MachineSnapshotTargetService {
	constructor(private readonly revisions: MachineDesiredStateRevisionService) {}

	async add(
		manager: EntityManager,
		machineId: string,
		snapshotRef: string,
		reason: MachineSnapshotTargetReason,
		template: SnapshotTemplatePreparation | null
	): Promise<void> {
		const inserted = await manager.execute<{ id: string }[]>(
			`insert into "machine_snapshot_target" ("machineId", "snapshotRef", "reason", "template")
			 values (?, ?, ?, ?)
			 on conflict ("machineId", "snapshotRef", "reason") do nothing
			 returning "id"`,
			[
				machineId,
				snapshotRef,
				reason,
				template ? JSON.stringify(template) : null,
			]
		);
		if (inserted.length > 0) {
			await this.revisions.advance(manager, [machineId]);
		}
	}

	async remove(
		manager: EntityManager,
		where: FilterQuery<MachineSnapshotTarget>
	): Promise<number> {
		const targets = await manager.find(MachineSnapshotTarget, where, {
			fields: ['id', 'machineId'],
		});
		if (targets.length === 0) return 0;
		await manager.nativeDelete(MachineSnapshotTarget, {
			id: { $in: targets.map(({ id }) => id) },
		});
		await this.revisions.advance(
			manager,
			targets.map(({ machineId }) => machineId)
		);
		return targets.length;
	}

	async removeInactivePropagation(
		manager: EntityManager,
		snapshotRefs: readonly string[]
	): Promise<number> {
		const refs = [...new Set(snapshotRefs)];
		if (refs.length === 0) return 0;
		const active = await manager.find(
			Snapshot,
			{ state: SnapshotState.ACTIVE, ref: { $in: refs } },
			{ fields: ['ref'] }
		);
		const activeRefs = new Set(active.map(({ ref }) => ref));
		const inactive = refs.filter((ref) => !activeRefs.has(ref));
		if (inactive.length === 0) return 0;
		return this.remove(manager, {
			reason: MachineSnapshotTargetReason.PROPAGATION,
			snapshotRef: { $in: inactive },
		});
	}
}
