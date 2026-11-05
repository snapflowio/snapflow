/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { ExposureDto } from '../../dto/exposure.dto';
import type { Exposure } from '../../entities/exposure.entity';

export function toExposureDto(exposure: Exposure): ExposureDto {
	return {
		id: exposure.id,
		organizationId: exposure.organizationId,
		sandboxId: exposure.sandboxId,
		name: exposure.name,
		kind: exposure.kind,
		protocol: exposure.protocol,
		visibility: exposure.visibility ?? undefined,
		systemService: exposure.systemService ?? undefined,
		targetPort: exposure.targetPort,
		policy: exposure.policy,
		desiredState: exposure.desiredState,
		observedState: exposure.observedState,
		generation: exposure.generation,
		platformHostname: exposure.platformHostname ?? undefined,
		originHostname: exposure.originHostname ?? undefined,
		lastError: exposure.lastError ?? undefined,
		systemRequestedUntil:
			exposure.systemRequestedUntil?.toISOString() ?? undefined,
		createdAt: exposure.createdAt.toISOString(),
		updatedAt: exposure.updatedAt.toISOString(),
	};
}
