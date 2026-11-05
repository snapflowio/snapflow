/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	SYSTEM_EXPOSURE_SERVICE,
	type SystemExposureService,
} from '../../constants/exposure.constants';
import type { MachineTunnelTargetDto } from '../../dto/machine-tunnel-plan.dto';
import type { Exposure } from '../../entities/exposure.entity';
import type { ExposureBackend } from '../../entities/exposure-backend.entity';

const GUEST_RELAYED_SYSTEM_SERVICES: ReadonlySet<SystemExposureService> =
	new Set([
		SYSTEM_EXPOSURE_SERVICE.TOOLBOX,
		SYSTEM_EXPOSURE_SERVICE.TERMINAL,
		SYSTEM_EXPOSURE_SERVICE.DESKTOP,
	]);

function guestServiceOf(
	systemService: SystemExposureService | null
): SystemExposureService | undefined {
	return systemService && GUEST_RELAYED_SYSTEM_SERVICES.has(systemService)
		? systemService
		: undefined;
}

export function machineTunnelTargetDto(
	backend: ExposureBackend,
	exposure: Exposure
): MachineTunnelTargetDto {
	const targetReference = normalizedTargetReference(exposure.targetReference);
	const guestService = guestServiceOf(exposure.systemService);
	return {
		backendId: backend.id,
		exposureId: backend.exposureId,
		exposureGeneration: backend.exposureGeneration,
		sandboxId: backend.sandboxId,
		assignmentGeneration: backend.assignmentGeneration,
		placementFencingTokenHash: backend.placementFencingTokenHash,
		protocol: backend.protocol,
		targetHost: exposure.targetHost,
		...(targetReference === undefined ? {} : { targetReference }),
		...(guestService === undefined ? {} : { guestService }),
		targetPort: backend.targetPort,
		state: backend.state,
		leaseExpiresAt: backend.leaseExpiresAt.toISOString(),
	};
}

function normalizedTargetReference(value: string | null): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}
