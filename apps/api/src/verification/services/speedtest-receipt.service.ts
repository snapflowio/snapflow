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
import { TypedConfigService } from '../../config/services/typed-config.service';
import { EDGE_STATUS } from '../../networking/constants/edge.constants';
import { LIVE_BINDING_STATES } from '../../networking/constants/machine-tunnel.constants';
import { Edge } from '../../networking/entities/edge.entity';
import { MachineEdgeBinding } from '../../networking/entities/machine-edge-binding.entity';
import { SPEEDTEST_ENDPOINT } from '../constants/benchmark-policy.constants';
import type { EdgeIdentityKey } from '../types/benchmark.types';

function rttRank(rtt: number | undefined): number {
	return rtt ?? Number.POSITIVE_INFINITY;
}

@Injectable()
export class SpeedtestReceiptService {
	private readonly edgeGuestOrigin: string | undefined;

	constructor(config: TypedConfigService) {
		this.edgeGuestOrigin = config.get('networking.edgeGuestOrigin');
	}

	async endpoint(
		manager: EntityManager,
		machineId: string
	): Promise<string | null> {
		const edge = await this.nearestEdge(manager, machineId);
		if (!edge) return null;
		const url = new URL(
			SPEEDTEST_ENDPOINT.PATH,
			this.edgeGuestOrigin ??
				`${SPEEDTEST_ENDPOINT.PROTOCOL}//${edge.publicHost}`
		);
		return url.toString();
	}

	private async nearestEdge(
		manager: EntityManager,
		machineId: string
	): Promise<Edge | undefined> {
		const [edges, bindings] = await Promise.all([
			manager.find(
				Edge,
				{ status: EDGE_STATUS.ACTIVE, identityKeyId: { $ne: null } },
				{ orderBy: { id: 'ASC' } }
			),
			manager.find(
				MachineEdgeBinding,
				{
					machineId,
					observedState: { $in: [...LIVE_BINDING_STATES] },
					observedRttMilliseconds: { $ne: null },
				},
				{ fields: ['edgeId', 'observedRttMilliseconds'] }
			),
		]);
		const rttByEdge = new Map(
			bindings.map((binding) => [
				binding.edgeId,
				binding.observedRttMilliseconds ?? undefined,
			])
		);
		return edges.reduce<Edge | undefined>(
			(nearest, edge) =>
				nearest &&
				rttRank(rttByEdge.get(nearest.id)) <= rttRank(rttByEdge.get(edge.id))
					? nearest
					: edge,
			undefined
		);
	}

	async edgeKeys(
		manager: EntityManager
	): Promise<ReadonlyMap<string, EdgeIdentityKey>> {
		const edges = await manager.find(Edge, {
			identityKeyId: { $ne: null },
			identityPublicKey: { $ne: null },
		});
		const keys = new Map<string, EdgeIdentityKey>();
		for (const edge of edges) {
			if (edge.identityKeyId && edge.identityPublicKey) {
				keys.set(edge.identityKeyId, {
					keyId: edge.identityKeyId,
					publicKeyPem: edge.identityPublicKey,
				});
			}
		}
		return keys;
	}
}
