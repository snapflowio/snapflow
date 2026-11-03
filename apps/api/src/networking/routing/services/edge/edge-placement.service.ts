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
import { addMilliseconds } from '../../../../common/utils/time.util';
import {
	EDGE_CONTROL_LIMITS,
	EDGE_STATUS,
} from '../../constants/edge.constants';
import { ACTIVE_BACKEND_STATES } from '../../constants/exposure.constants';
import { LIVE_BINDING_STATES } from '../../constants/machine-tunnel.constants';
import {
	NETWORK_PROTOCOL,
	NETWORKING_RECONCILIATION,
} from '../../constants/networking.constants';
import { Edge } from '../../entities/edge.entity';
import type { Exposure } from '../../entities/exposure.entity';

@Injectable()
export class EdgePlacementService {
	async select(
		manager: EntityManager,
		exposure: Exposure,
		machineId: string,
		observedAt: Date,
		preferredEdgeId?: string
	): Promise<Edge | null> {
		const heartbeatAfter = addMilliseconds(
			observedAt,
			-NETWORKING_RECONCILIATION.edgeHeartbeatMaximumAgeMilliseconds
		);
		const [selected] = await manager.execute<{ id: string }[]>(
			`SELECT edge.id
			 FROM network_edge edge
			 LEFT JOIN LATERAL (
			   SELECT binding."observedRttMilliseconds"
			   FROM machine_edge_binding binding
			   WHERE binding."machineId" = ?
			     AND binding."edgeId" = edge.id
			     AND binding."observedState" = ANY(ARRAY[?]::varchar[])
			     AND binding."leaseExpiresAt" > ?
			   ORDER BY binding."updatedAt" DESC, binding.id DESC
			   LIMIT 1
			 ) binding ON true
			 LEFT JOIN LATERAL (
			   SELECT COUNT(*) AS total
			   FROM sandbox_exposure_backend backend
			   WHERE backend."edgeId" = edge.id
			     AND backend.state = ANY(ARRAY[?]::varchar[])
			     AND backend."leaseExpiresAt" > ?
			 ) routes ON true
			 WHERE edge.status = ?
			   AND edge."sessionExpiresAt" > ?
			   AND edge."lastHeartbeatAt" > ?
			   AND ? = ANY(edge."supportedProtocols")
			   AND edge."observedCapacity" IS NOT NULL
			   AND (edge."observedCapacity"->>'placementEligible')::boolean
			   AND (edge."observedCapacity"->>'tunnelHeadroom')::integer > 0
			   AND CASE ?
			     WHEN ? THEN (edge."observedCapacity"->>'httpRequestHeadroom')::integer > 0
			       AND (edge."observedCapacity"->>'httpConnectionHeadroom')::integer > 0
			       AND (edge."observedCapacity"->>'httpStreamHeadroom')::integer > 0
			     WHEN ? THEN (edge."observedCapacity"->>'tcpConnectionHeadroom')::integer > 0
			     WHEN ? THEN (edge."observedCapacity"->>'udpFlowHeadroom')::integer > 0
			     ELSE false
			   END
			   AND routes.total < ?
			 ORDER BY (edge.id = ?) DESC,
			   binding."observedRttMilliseconds" ASC NULLS LAST,
			   routes.total ASC,
			   (edge."observedCapacity"->>'cpuUtilization')::numeric ASC NULLS LAST,
			   edge."lastFailureAt" ASC NULLS FIRST,
			   edge.id ASC
			 LIMIT 1`,
			[
				machineId,
				LIVE_BINDING_STATES,
				observedAt,
				ACTIVE_BACKEND_STATES,
				observedAt,
				EDGE_STATUS.ACTIVE,
				observedAt,
				heartbeatAfter,
				exposure.protocol,
				exposure.protocol,
				NETWORK_PROTOCOL.HTTP,
				NETWORK_PROTOCOL.TCP,
				NETWORK_PROTOCOL.UDP,
				EDGE_CONTROL_LIMITS.maximumRoutesPerSnapshot,
				preferredEdgeId ?? null,
			]
		);
		return selected
			? manager.findOne(Edge, { id: selected.id }, { refresh: true })
			: null;
	}
}
