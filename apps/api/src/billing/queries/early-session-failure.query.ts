/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { MACHINE_HEALTH_STALE_THRESHOLD_MS } from '../../machine/constants/machine.constants';
import { EARLY_FAILURE_WINDOW_MILLISECONDS } from '../../usage/constants/usage-accounting.constants';
import type { SandboxUsagePeriod } from '../../usage/entities/sandbox-usage-period.entity';

export type SessionPeriod = Pick<
	SandboxUsagePeriod,
	| 'sandboxId'
	| 'placementId'
	| 'assignmentGeneration'
	| 'startAt'
	| 'runningSince'
>;

export async function earlyFailureCovers(
	manager: EntityManager,
	period: Pick<
		SessionPeriod,
		'placementId' | 'assignmentGeneration' | 'startAt'
	>
): Promise<boolean> {
	const [row] = await manager.execute<{ covered: boolean }[]>(
		`SELECT EXISTS (
			SELECT 1 FROM early_session_failure failure
			WHERE failure."placementId" = ?
			  AND failure."assignmentGeneration" = ?
			  AND failure."sessionStartedAt" <= ?
			  AND failure."lastHealthyAt" >= ?
		) AS covered`,
		[
			period.placementId,
			period.assignmentGeneration,
			period.startAt,
			period.startAt,
		]
	);
	return row?.covered === true;
}

export function openEarlyFailures(
	manager: EntityManager
): Promise<{ id: string }[]> {
	return manager.execute<{ id: string }[]>(
		`SELECT period.id
		 FROM sandbox_usage_periods period
		 JOIN machine ON machine.id = period."machineId"
		 WHERE period."endAt" IS NULL
		   AND period."runningSince" IS NOT NULL
		   AND machine."lastHealthyAt" IS NOT NULL
		   AND machine."lastHealthyAt" < now() - make_interval(secs => ? / 1000.0)
		   AND machine."lastHealthyAt" < period."runningSince" + make_interval(secs => ? / 1000.0)`,
		[MACHINE_HEALTH_STALE_THRESHOLD_MS, EARLY_FAILURE_WINDOW_MILLISECONDS]
	);
}
