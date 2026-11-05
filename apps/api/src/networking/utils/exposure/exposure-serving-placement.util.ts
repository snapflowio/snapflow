/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode, QueryOrder } from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/postgresql';
import { SandboxPlacement } from '../../../sandbox/entities/sandbox-placement.entity';
import {
	SYSTEM_EXPOSURE_SERVICE,
	type SystemExposureService,
} from '../../constants/exposure.constants';
import type { Exposure } from '../../entities/exposure.entity';

export function systemExposureNeedsRuntime(
	service: SystemExposureService | null
): boolean {
	return service !== SYSTEM_EXPOSURE_SERVICE.BUILD_LOGS;
}

export async function findServingPlacement(
	manager: EntityManager,
	exposure: Pick<Exposure, 'sandboxId' | 'systemService'>,
	lockMode: LockMode.NONE | LockMode.PESSIMISTIC_READ = LockMode.NONE
): Promise<SandboxPlacement | null> {
	const active = await manager.findOne(
		SandboxPlacement,
		{ sandboxId: exposure.sandboxId, releasedAt: null },
		{ lockMode, refresh: true }
	);
	if (active || systemExposureNeedsRuntime(exposure.systemService)) {
		return active;
	}
	return manager.findOne(
		SandboxPlacement,
		{ sandboxId: exposure.sandboxId },
		{
			lockMode,
			refresh: true,
			orderBy: { placedAt: QueryOrder.DESC, id: QueryOrder.DESC },
		}
	);
}
