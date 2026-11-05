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
import { addMilliseconds } from '../../common/utils/time.util';
import { MACHINE_SNAPSHOT_TARGETS } from '../../machine/constants/machine-snapshot.constants';
import { MachineSnapshotTargetReason } from '../../machine/enums/machine-snapshot-target-reason.enum';
import { MachineState } from '../../machine/enums/machine-state.enum';
import { MachineTier } from '../../marketplace/enums/machine-tier.enum';
import type { Snapshot } from '../entities/snapshot.entity';

interface MachinePredicate {
	sql: string;
	bindings: unknown[];
}

enum MachinePool {
	OWNER = 'owner',
	MARKETPLACE = 'marketplace',
}

@Injectable()
export class SnapshotMachineSelectionService {
	constructor(private readonly entityManager: EntityManager) {}

	async propagationCandidates(snapshot: Snapshot): Promise<string[]> {
		if (!snapshot.ref) return [];
		const ownerCandidates = snapshot.organizationId
			? await this.untargetedMachineIds(
					snapshot,
					MachinePool.OWNER,
					MACHINE_SNAPSHOT_TARGETS.assignmentBatchSize
				)
			: [];
		const remainingCapacity =
			MACHINE_SNAPSHOT_TARGETS.assignmentBatchSize - ownerCandidates.length;
		if (remainingCapacity === 0) return ownerCandidates;
		const marketplaceTarget = Math.ceil(
			(await this.eligibleMachineCount(snapshot, MachinePool.MARKETPLACE)) *
				MACHINE_SNAPSHOT_TARGETS.propagationFactor
		);
		const targeted = await this.targetedMachineCount(
			snapshot,
			MachinePool.MARKETPLACE
		);
		const marketplaceCandidates = await this.untargetedMachineIds(
			snapshot,
			MachinePool.MARKETPLACE,
			Math.min(remainingCapacity, Math.max(0, marketplaceTarget - targeted))
		);
		return [...ownerCandidates, ...marketplaceCandidates];
	}

	async scaleDownCandidates(snapshot: Snapshot): Promise<string[]> {
		if (!snapshot.ref) return [];
		const eligible = await this.eligibleMachineCount(
			snapshot,
			MachinePool.MARKETPLACE
		);
		if (eligible === 0) return [];
		const protectedAfter = addMilliseconds(
			new Date(),
			-MACHINE_SNAPSHOT_TARGETS.scaleDownProtectionMilliseconds
		);
		const targeted = await this.targetedMachineCount(
			snapshot,
			MachinePool.MARKETPLACE,
			protectedAfter
		);
		const target = Math.ceil(
			MACHINE_SNAPSHOT_TARGETS.propagationFactor * eligible
		);
		if (
			targeted <=
			Math.ceil(target * MACHINE_SNAPSHOT_TARGETS.scaleDownExcessFactor)
		) {
			return [];
		}
		const predicate = this.machinePredicate(snapshot, MachinePool.MARKETPLACE);
		const rows = await this.entityManager.execute<{ id: string }[]>(
			`SELECT target.id
			 FROM machine_snapshot_target target
			 INNER JOIN machine ON machine.id = target."machineId"
			 WHERE target."snapshotRef" = ? AND target.reason = ? AND target."createdAt" < ?
			   AND ${predicate.sql}
			 ORDER BY target."createdAt" ASC, target.id ASC
			 LIMIT ?`,
			[
				snapshot.ref,
				MachineSnapshotTargetReason.PROPAGATION,
				protectedAfter,
				...predicate.bindings,
				Math.min(
					targeted - target,
					MACHINE_SNAPSHOT_TARGETS.scaleDownBatchSize
				),
			]
		);
		return rows.map(({ id }) => id);
	}

	private async untargetedMachineIds(
		snapshot: Snapshot,
		pool: MachinePool,
		limit: number
	): Promise<string[]> {
		if (!snapshot.ref || limit === 0) return [];
		const predicate = this.machinePredicate(snapshot, pool);
		const rows = await this.entityManager.execute<{ id: string }[]>(
			`SELECT machine.id
			 FROM machine
			 WHERE ${predicate.sql}
			   AND NOT EXISTS (
			     SELECT 1 FROM machine_snapshot_target target
			     WHERE target."machineId" = machine.id
			       AND target."snapshotRef" = ? AND target.reason = ?
			   )
			 ORDER BY md5(machine.id::text || ?), machine.id ASC
			 LIMIT ?`,
			[
				...predicate.bindings,
				snapshot.ref,
				MachineSnapshotTargetReason.PROPAGATION,
				snapshot.ref,
				limit,
			]
		);
		return rows.map(({ id }) => id);
	}

	private async eligibleMachineCount(
		snapshot: Snapshot,
		pool: MachinePool
	): Promise<number> {
		const predicate = this.machinePredicate(snapshot, pool);
		const [row] = await this.entityManager.execute<{ total: string }[]>(
			`SELECT COUNT(*) AS total FROM machine WHERE ${predicate.sql}`,
			predicate.bindings
		);
		return Number(row?.total ?? 0);
	}

	private async targetedMachineCount(
		snapshot: Snapshot,
		pool: MachinePool,
		createdBefore?: Date
	): Promise<number> {
		if (!snapshot.ref) return 0;
		const predicate = this.machinePredicate(snapshot, pool);
		const createdAtSql = createdBefore ? 'AND target."createdAt" < ?' : '';
		const [row] = await this.entityManager.execute<{ total: string }[]>(
			`SELECT COUNT(*) AS total
			 FROM machine_snapshot_target target
			 INNER JOIN machine ON machine.id = target."machineId"
			 WHERE target."snapshotRef" = ? AND target.reason = ?
			   ${createdAtSql}
			   AND ${predicate.sql}`,
			[
				snapshot.ref,
				MachineSnapshotTargetReason.PROPAGATION,
				...(createdBefore ? [createdBefore] : []),
				...predicate.bindings,
			]
		);
		return Number(row?.total ?? 0);
	}

	private machinePredicate(
		snapshot: Snapshot,
		pool: MachinePool
	): MachinePredicate {
		const gpuSql =
			snapshot.gpu > 0 ? 'machine."gpuCount" >= ?' : 'machine."gpuCount" = 0';
		const poolSql =
			pool === MachinePool.OWNER
				? 'machine."organizationId" IS NOT DISTINCT FROM ?'
				: `machine."organizationId" IS DISTINCT FROM ?
				AND machine.tier <> ? AND machine."restrictedAt" IS NULL`;
		return {
			sql: `machine.state = ?
			  AND machine.unschedulable <> true
			  AND machine."sandboxClass" = ?
			  AND ${gpuSql}
			  AND machine."gpuType" IS NOT DISTINCT FROM ?
			  AND ${poolSql}`,
			bindings: [
				MachineState.READY,
				snapshot.sandboxClass,
				...(snapshot.gpu > 0 ? [snapshot.gpu] : []),
				snapshot.gpuType,
				snapshot.organizationId ?? null,
				...(pool === MachinePool.MARKETPLACE ? [MachineTier.PRIVATE] : []),
			],
		};
	}
}
