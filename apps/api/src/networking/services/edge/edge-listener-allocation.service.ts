/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { ConflictException, Injectable } from '@nestjs/common';
import { apiError } from '../../../common/utils/error/api-error.util';
import { ACTIVE_BACKEND_STATES } from '../../constants/exposure.constants';
import {
	NETWORK_PROTOCOL,
	NETWORKING_LIMITS,
	type NetworkProtocol,
} from '../../constants/networking.constants';
import type { Edge } from '../../entities/edge.entity';
import { ExposureBackend } from '../../entities/exposure-backend.entity';
import { NetworkingErrorCode } from '../../enums/networking-error-code.enum';

@Injectable()
export class EdgeListenerAllocationService {
	async allocate(
		manager: EntityManager,
		edge: Edge,
		protocol: NetworkProtocol,
		reusablePort?: number | null
	): Promise<number | null> {
		if (protocol === NETWORK_PROTOCOL.HTTP) return null;
		const usedRows = await manager.find(
			ExposureBackend,
			{
				edgeId: edge.id,
				protocol,
				publicPort: { $ne: null },
				state: { $in: [...ACTIVE_BACKEND_STATES] },
			},
			{ fields: ['publicPort'] }
		);
		const used = new Set(
			usedRows
				.map((backend) => backend.publicPort)
				.filter(
					(port): port is number => port !== null && port !== reusablePort
				)
		);
		const ranges = [...edge.portInventory[protocol]].sort(
			(left, right) => left.from - right.from || left.to - right.to
		);
		for (const range of ranges) {
			if (
				range.from < NETWORKING_LIMITS.minimumPort ||
				range.to > NETWORKING_LIMITS.maximumPort ||
				range.from > range.to
			) {
				throw new ConflictException(
					apiError(
						NetworkingErrorCode.EDGE_PORT_RANGE_INVALID,
						`Edge ${edge.id} has an invalid port range. Fix the port range of the Edge and retry.`
					)
				);
			}
			if (
				reusablePort !== null &&
				reusablePort !== undefined &&
				reusablePort >= range.from &&
				reusablePort <= range.to
			) {
				return reusablePort;
			}
			for (let port = range.from; port <= range.to; port += 1) {
				if (!used.has(port)) return port;
			}
		}
		throw new ConflictException(
			apiError(
				NetworkingErrorCode.EDGE_CAPACITY_EXHAUSTED,
				`No ${protocol.toUpperCase()} port is free right now. Try again later, or delete an exposure you no longer need.`
			)
		);
	}
}
