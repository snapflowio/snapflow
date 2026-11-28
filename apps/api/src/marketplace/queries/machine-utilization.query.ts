/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { BASIS_POINTS_SCALE } from '../../common/constants/money.constants';
import { UsageMode } from '../../usage/constants/usage-lifecycle.constants';
import { CAPACITY_CPU_SQL } from './machine-eligibility.query';

export const UTILIZATION_WINDOW_DAYS = {
	lastWeekBasisPoints: 7,
	lastMonthBasisPoints: 30,
} as const;

type UtilizationWindow = keyof typeof UTILIZATION_WINDOW_DAYS;

export type MachineUtilization = Record<UtilizationWindow, number | null>;

const WINDOWS = Object.entries(UTILIZATION_WINDOW_DAYS) as [
	UtilizationWindow,
	number,
][];

const LONGEST_WINDOW_DAYS = Math.max(...Object.values(UTILIZATION_WINDOW_DAYS));

const NO_UTILIZATION: MachineUtilization = {
	lastWeekBasisPoints: null,
	lastMonthBasisPoints: null,
};

const MACHINE_UTILIZATION_SQL = `WITH rented AS (
		SELECT usage."machineId" AS machine_id, usage.cpu, usage.gpu,
			usage."startAt" AS started, usage."endAt" AS ended
		FROM sandbox_billable_usage usage
		WHERE usage."machineId" = ANY(ARRAY[?]::uuid[])
		  AND usage."runningMillis" > 0
		  AND usage."endAt" > now() - (? * interval '1 day')
		UNION ALL
		SELECT period."machineId", period.cpu, period.gpu, period."startAt", now()
		FROM sandbox_usage_periods period
		JOIN placement_price price ON price.id = period."placementPriceId"
			AND price."priceCardId" IS NOT NULL
		WHERE period."machineId" = ANY(ARRAY[?]::uuid[])
		  AND period."endAt" IS NULL AND period.mode = ?
	),
	windows AS (
		SELECT machine.id, machine."gpuCount" AS gpus, ${CAPACITY_CPU_SQL} AS vcpus,
			window_days.days,
			GREATEST(machine."listedSince", now() - (window_days.days * interval '1 day')) AS since
		FROM machine
		CROSS JOIN unnest(ARRAY[?]::int[]) AS window_days(days)
		WHERE machine.id = ANY(ARRAY[?]::uuid[]) AND machine."listedSince" IS NOT NULL
	)
	SELECT windows.id AS "machineId", windows.days,
		floor(? * COALESCE(sum(
			(CASE WHEN windows.gpus > 0 THEN rented.gpu ELSE rented.cpu END)
			* GREATEST(extract(epoch FROM LEAST(rented.ended, now()) - GREATEST(rented.started, windows.since)), 0)
		), 0) / NULLIF(
			(CASE WHEN windows.gpus > 0 THEN windows.gpus ELSE windows.vcpus END)
			* extract(epoch FROM now() - windows.since), 0))::int AS "basisPoints"
	FROM windows
	LEFT JOIN rented ON rented.machine_id = windows.id
	GROUP BY windows.id, windows.days, windows.gpus, windows.vcpus, windows.since`;

export async function machineUtilization(
	manager: EntityManager,
	machineIds: readonly string[]
): Promise<Map<string, MachineUtilization>> {
	const utilization = new Map<string, MachineUtilization>();
	if (machineIds.length === 0) return utilization;
	const rows = await manager.execute<
		{ machineId: string; days: number; basisPoints: number | null }[]
	>(MACHINE_UTILIZATION_SQL, [
		machineIds,
		LONGEST_WINDOW_DAYS,
		machineIds,
		UsageMode.FULL,
		WINDOWS.map(([, days]) => days),
		machineIds,
		BASIS_POINTS_SCALE,
	]);
	for (const { machineId, days, basisPoints } of rows) {
		const window = WINDOWS.find(([, windowDays]) => windowDays === days)?.[0];
		if (!window || basisPoints === null) continue;
		utilization.set(machineId, {
			...(utilization.get(machineId) ?? NO_UTILIZATION),
			[window]: Math.min(basisPoints, BASIS_POINTS_SCALE),
		});
	}
	return utilization;
}

export function utilizationOf(
	utilization: ReadonlyMap<string, MachineUtilization>,
	machineId: string
): MachineUtilization {
	return utilization.get(machineId) ?? NO_UTILIZATION;
}
