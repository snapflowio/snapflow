/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { PLACEMENT_FAILURE_TIMING } from '../constants/machine-placement.constants';
import {
	MACHINE_RELIABILITY_EVENT_KIND,
	MACHINE_RELIABILITY_OUTCOME,
} from '../constants/machine-reliability.constants';
import {
	EVIDENCE_WINDOW_START_SQL,
	evidenceWeightSql,
} from './machine-evidence-weight.query';

const TIMESTAMP_RESOLUTION_SECONDS = 1e-6;

const REFRESH_SQL = `WITH placement AS (
		SELECT placement.locality, placement."placedAt" AS placed_at,
			(SELECT MIN(event."observedAt") FROM machine_reliability_event event
				WHERE event."placementId" = placement.id AND event."eventKind" = ? AND event.outcome = ?) AS ready_at,
			(SELECT MIN(event."observedAt") FROM machine_reliability_event event
				WHERE event."placementId" = placement.id AND event.outcome = ANY(ARRAY[?]::varchar[])) AS failed_at
		FROM sandbox_placement placement
		WHERE placement."machineId" = ? AND placement."placedAt" >= ${EVIDENCE_WINDOW_START_SQL}
			AND placement.locality IS NOT NULL
	),
	timed AS (
		SELECT CASE WHEN failed_at IS NULL OR ready_at <= failed_at THEN locality ELSE ? END AS kind,
			LEAST(ready_at, failed_at) AS observed_at, placed_at
		FROM placement WHERE ready_at IS NOT NULL OR failed_at IS NOT NULL
	),
	weighted AS (
		SELECT kind, ${evidenceWeightSql('observed_at')} AS weight,
			ln(GREATEST(extract(epoch FROM observed_at - placed_at), ?)) AS log_seconds
		FROM timed
	)
	INSERT INTO machine_placement_timing ("machineId", kind, "sampleMass", "meanLogSeconds", "meanSquareLogSeconds")
	SELECT ?, kind, SUM(weight), SUM(weight * log_seconds) / SUM(weight), SUM(weight * log_seconds ^ 2) / SUM(weight)
	FROM weighted GROUP BY kind HAVING SUM(weight) > 0`;

export async function refreshMachinePlacementTimings(
	manager: EntityManager,
	machineId: string
): Promise<void> {
	await manager.execute(
		'DELETE FROM machine_placement_timing WHERE "machineId" = ?',
		[machineId]
	);
	await manager.execute(REFRESH_SQL, [
		MACHINE_RELIABILITY_EVENT_KIND.SANDBOX_CONVERGENCE,
		MACHINE_RELIABILITY_OUTCOME.SUCCESS,
		[
			MACHINE_RELIABILITY_OUTCOME.FAILURE,
			MACHINE_RELIABILITY_OUTCOME.UNATTRIBUTED,
		],
		machineId,
		PLACEMENT_FAILURE_TIMING,
		TIMESTAMP_RESOLUTION_SECONDS,
		machineId,
	]);
}
