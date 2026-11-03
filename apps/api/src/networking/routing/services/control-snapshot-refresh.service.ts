/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { RequestContext, TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { ControlWakeService } from '../../../infra/control-wake/services/control-wake.service';
import { NO_KEY_UPDATE_LOCK } from '../../../infra/database/utils/row-lock.util';
import type { Machine } from '../../../sandbox/machine/entities/machine.entity';
import { EDGE_CONTROL_LIMITS } from '../constants/edge.constants';
import { ACTIVE_BACKEND_STATES } from '../constants/exposure.constants';
import { NETWORK_WAKE_TOPIC } from '../constants/networking.constants';
import type { Edge } from '../entities/edge.entity';

type SqlParameter = string | number | Date;

interface RefreshScope {
	filter: string;
	locking: string;
	parameters: readonly SqlParameter[];
}

const MACHINE_GENERATED_AT = 'tunnelPlanGeneratedAt';
const EDGE_GENERATED_AT = 'routeTableGeneratedAt';

const staleFilter = (generatedAtColumn: string): string =>
	`AND "${generatedAtColumn}" <= transaction_timestamp() - (? * interval '1 millisecond')`;

const sweepScope = (generatedAtColumn: string): RefreshScope => ({
	filter: staleFilter(generatedAtColumn),
	locking: `ORDER BY "${generatedAtColumn}" ASC, id ASC ${NO_KEY_UPDATE_LOCK} SKIP LOCKED LIMIT ?`,
	parameters: [
		EDGE_CONTROL_LIMITS.routeSnapshotRefreshIntervalMilliseconds,
		EDGE_CONTROL_LIMITS.controlSnapshotRefreshBatchSize,
	],
});

const subjectScope = (generatedAtColumn: string, id: string): RefreshScope => ({
	filter: `${staleFilter(generatedAtColumn)} AND id = ?`,
	locking: NO_KEY_UPDATE_LOCK,
	parameters: [
		EDGE_CONTROL_LIMITS.routeSnapshotRefreshIntervalMilliseconds,
		id,
	],
});

const generatedBeforeScope = (
	generatedAtColumn: string,
	since: Date
): RefreshScope => ({
	filter: `AND "${generatedAtColumn}" < ?`,
	locking: NO_KEY_UPDATE_LOCK,
	parameters: [since],
});

const edgeVersionScope = (id: string, version: string): RefreshScope => ({
	filter: 'AND id = ? AND "routeTableVersion" = ?',
	locking: NO_KEY_UPDATE_LOCK,
	parameters: [id, version],
});

const backendStatePlaceholders = ACTIVE_BACKEND_STATES.map(() => '?').join(
	', '
);

@Injectable()
export class ControlSnapshotRefreshService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly wakes: ControlWakeService
	) {}

	async refresh(): Promise<void> {
		const refreshed = await RequestContext.create(this.entityManager, () =>
			this.entityManager.transactional(
				async (transaction) => ({
					machineIds: await this.refreshMachines(
						transaction,
						sweepScope(MACHINE_GENERATED_AT)
					),
					edgeIds: await this.refreshEdges(
						transaction,
						sweepScope(EDGE_GENERATED_AT)
					),
				}),
				{ propagation: TransactionPropagation.REQUIRED }
			)
		);
		this.wakes.notify(
			NETWORK_WAKE_TOPIC.MACHINE_TUNNEL_PLAN,
			refreshed.machineIds
		);
		this.wakes.notify(NETWORK_WAKE_TOPIC.EDGE_ROUTES, refreshed.edgeIds);
	}

	async refreshMachineIfStale(machineId: string): Promise<void> {
		const machineIds = await this.refreshMachines(
			this.entityManager,
			subjectScope(MACHINE_GENERATED_AT, machineId)
		);
		this.wakes.notify(NETWORK_WAKE_TOPIC.MACHINE_TUNNEL_PLAN, machineIds);
	}

	async refreshEdgeIfStale(edgeId: string): Promise<void> {
		const edgeIds = await this.refreshEdges(
			this.entityManager,
			subjectScope(EDGE_GENERATED_AT, edgeId)
		);
		this.wakes.notify(NETWORK_WAKE_TOPIC.EDGE_ROUTES, edgeIds);
	}

	async refreshEdgesGeneratedBefore(since: Date): Promise<void> {
		const edgeIds = await RequestContext.create(this.entityManager, () =>
			this.refreshEdges(
				this.entityManager,
				generatedBeforeScope(EDGE_GENERATED_AT, since)
			)
		);
		this.wakes.notify(NETWORK_WAKE_TOPIC.EDGE_ROUTES, edgeIds);
	}

	async reissueEdgeVersion(edgeId: string, version: string): Promise<void> {
		const edgeIds = await this.refreshEdges(
			this.entityManager,
			edgeVersionScope(edgeId, version)
		);
		this.wakes.notify(NETWORK_WAKE_TOPIC.EDGE_ROUTES, edgeIds);
	}

	private async refreshMachines(
		manager: EntityManager,
		scope: RefreshScope
	): Promise<string[]> {
		const refreshed = await manager.execute<Pick<Machine, 'id'>[]>(
			`WITH candidates AS (
				SELECT id
				FROM "machine"
				WHERE "sessionExpiresAt" > transaction_timestamp()
				  ${scope.filter}
				${scope.locking}
			)
			UPDATE "machine" machine
			SET "tunnelPlanVersion" = machine."tunnelPlanVersion" + 1,
			    "tunnelPlanGeneratedAt" = transaction_timestamp(),
			    "updatedAt" = transaction_timestamp()
			FROM candidates
			WHERE machine.id = candidates.id
			RETURNING machine.id`,
			scope.parameters
		);
		return refreshed.map((machine) => machine.id);
	}

	private async refreshEdges(
		manager: EntityManager,
		scope: RefreshScope
	): Promise<string[]> {
		const refreshed = await manager.execute<Pick<Edge, 'id'>[]>(
			`WITH candidates AS (
				SELECT id
				FROM "network_edge"
				WHERE "sessionExpiresAt" > transaction_timestamp()
				  ${scope.filter}
				${scope.locking}
			), refreshed AS (
				UPDATE "network_edge" edge
				SET "routeTableVersion" = edge."routeTableVersion" + 1,
				    "routeTableGeneratedAt" = transaction_timestamp(),
				    "updatedAt" = transaction_timestamp()
				FROM candidates
				WHERE edge.id = candidates.id
				RETURNING edge."id", edge."routeTableVersion"
			), updated_backends AS (
				UPDATE "sandbox_exposure_backend" backend
				SET "routeTableVersion" = refreshed."routeTableVersion",
				    "updatedAt" = transaction_timestamp()
				FROM refreshed
				WHERE backend."edgeId" = refreshed."id"
				  AND backend."state" IN (${backendStatePlaceholders})
				RETURNING backend."id"
			)
			SELECT refreshed."id" FROM refreshed`,
			[...scope.parameters, ...ACTIVE_BACKEND_STATES]
		);
		return refreshed.map((edge) => edge.id);
	}
}
