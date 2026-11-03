/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { ControlWakeService } from '../../../infra/control-wake/services/control-wake.service';
import { lockMachinesForUpdate } from '../../../sandbox/machine/utils/machine-lock.util';
import { ACTIVE_BACKEND_STATES } from '../constants/exposure.constants';
import { NETWORK_WAKE_TOPIC } from '../constants/networking.constants';
import { lockEdges } from '../utils/network-lock.util';

@Injectable()
export class NetworkControlVersionService {
	constructor(private readonly wakes: ControlWakeService) {}

	async bumpEdges(
		manager: EntityManager,
		edgeIds: Iterable<string>,
		generatedAt: Date
	): Promise<void> {
		const edges = await lockEdges(manager, edgeIds);
		if (edges.length === 0) return;
		for (const edge of edges) {
			edge.routeTableVersion = this.nextVersion(edge.routeTableVersion);
			edge.routeTableGeneratedAt = generatedAt;
		}
		const cases = edges.map(() => 'WHEN ?::uuid THEN ?::bigint').join(' ');
		const edgePlaceholders = edges.map(() => '?::uuid').join(', ');
		const statePlaceholders = ACTIVE_BACKEND_STATES.map(() => '?').join(', ');
		await manager.execute(
			`UPDATE "sandbox_exposure_backend"
			 SET "routeTableVersion" = CASE "edgeId" ${cases} ELSE "routeTableVersion" END,
			     "updatedAt" = ?
			 WHERE "edgeId" IN (${edgePlaceholders})
			   AND state IN (${statePlaceholders})`,
			[
				...edges.flatMap((edge) => [edge.id, edge.routeTableVersion]),
				generatedAt,
				...edges.map((edge) => edge.id),
				...ACTIVE_BACKEND_STATES,
			]
		);
		this.wakes.notifyAfterCommit(
			manager,
			NETWORK_WAKE_TOPIC.EDGE_ROUTES,
			edges.map((edge) => edge.id)
		);
	}

	async bumpMachines(
		manager: EntityManager,
		machineIds: Iterable<string>,
		generatedAt: Date
	): Promise<void> {
		const machines = await lockMachinesForUpdate(manager, machineIds);
		if (machines.length === 0) return;
		for (const machine of machines) {
			machine.tunnelPlanVersion = this.nextVersion(machine.tunnelPlanVersion);
			machine.tunnelPlanGeneratedAt = generatedAt;
		}
		this.wakes.notifyAfterCommit(
			manager,
			NETWORK_WAKE_TOPIC.MACHINE_TUNNEL_PLAN,
			machines.map((machine) => machine.id)
		);
	}

	private nextVersion(current: string): string {
		return (BigInt(current) + 1n).toString();
	}
}
