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
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { EDGE_REACHABILITY, EDGE_STATUS } from '../../constants/edge.constants';
import { Edge } from '../../entities/edge.entity';
import { acceptsTcp } from '../../utils/edge/edge-reachability.util';

@Injectable()
export class EdgeReachabilityService {
	private readonly logger = new Logger(EdgeReachabilityService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly config: TypedConfigService
	) {}

	async probeActive(): Promise<void> {
		const manager = this.entityManager.fork();
		const edges = await manager.find(
			Edge,
			{ status: { $in: [EDGE_STATUS.ACTIVE, EDGE_STATUS.DRAINING] } },
			{ limit: EDGE_REACHABILITY.batchSize, orderBy: { id: 'asc' } }
		);
		if (edges.length === 0) return;
		const httpsPort =
			this.config.get('networking').edgeHttpsPort ??
			EDGE_REACHABILITY.defaultHttpsPort;
		const results = await Promise.all(
			edges.map(async (edge) => ({
				edge,
				reachable: await this.reachable(edge, httpsPort),
			}))
		);
		const now = await databaseNow(manager);
		for (const { edge, reachable } of results) {
			if (reachable) {
				edge.reachabilityConfirmedAt = now;
			} else {
				this.logger.warn(
					`Edge ${edge.id} is not reachable on ${edge.publicHost}:${httpsPort} or its tunnel port ${edge.tunnelAddress.port}`
				);
			}
		}
		await manager.flush();
	}

	private async reachable(edge: Edge, httpsPort: number): Promise<boolean> {
		const [https, tunnel] = await Promise.all([
			acceptsTcp(
				edge.publicHost,
				httpsPort,
				EDGE_REACHABILITY.probeTimeoutMilliseconds
			),
			acceptsTcp(
				edge.tunnelAddress.host,
				edge.tunnelAddress.port,
				EDGE_REACHABILITY.probeTimeoutMilliseconds
			),
		]);
		return https && tunnel;
	}
}
