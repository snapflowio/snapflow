/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import {
	MACHINE_TRUST_POLICY,
	MAJORITY_SHARE,
} from '../../../billing/constants/machine-trust.constants';
import {
	SANDBOX_STATES_CONVERGING,
	SLOW_START_INITIAL_WINDOW,
} from '../constants/machine-placement.constants';
import { MACHINE_RELIABILITY_OUTCOME } from '../constants/machine-reliability.constants';
import {
	EVIDENCE_WINDOW_START_SQL,
	evidenceWeightSql,
	wilsonLowerBoundSql,
} from './machine-evidence-weight.query';

export interface MachinePlacementCondition {
	sql: string;
	bindings: unknown[];
}

const { SUCCESS, FAILURE, UNATTRIBUTED } = MACHINE_RELIABILITY_OUTCOME;

const SIBLING_SQL = 'sibling."organizationId" = machine."organizationId"';

const SLOW_START_SQL = `load.converging < assessment."placementWindow"
	AND (machine."organizationId" IS NULL
		OR (SELECT COUNT(*) FROM machine sibling
				JOIN sandbox converging ON converging."machineId" = sibling.id
				WHERE ${SIBLING_SQL} AND converging.state = ANY(ARRAY[?]::sandbox_state_enum[]))
			< ${SLOW_START_INITIAL_WINDOW} + (SELECT COALESCE(SUM(sibling_assessment."successfulSamples"), 0)
				FROM machine sibling
				JOIN machine_assessment sibling_assessment ON sibling_assessment."machineId" = sibling.id
				WHERE ${SIBLING_SQL}))`;

const WORKLOAD_PAIRING_SQL = `SELECT
		SUM(CASE event.outcome WHEN '${FAILURE}' THEN 1 WHEN '${UNATTRIBUTED}' THEN ${MACHINE_TRUST_POLICY.unattributedFailureWeight} ELSE 0 END
			* ${evidenceWeightSql('event."observedAt"')}) AS failures,
		SUM(CASE event.outcome WHEN '${SUCCESS}' THEN 1 ELSE 0 END
			* ${evidenceWeightSql('event."observedAt"')}) AS successes
	FROM machine_reliability_event event
	WHERE event."observedAt" >= ${EVIDENCE_WINDOW_START_SQL}`;

const EXCLUDED_PAIRING_SQL = `${wilsonLowerBoundSql(
	'pairing.failures',
	'(pairing.failures + pairing.successes)',
	MACHINE_TRUST_POLICY.tripZScore
)} > ${MAJORITY_SHARE}`;

export function machineTrustPlacementCondition(
	workloadFingerprint: string | undefined
): MachinePlacementCondition {
	const bindings: unknown[] = [SANDBOX_STATES_CONVERGING];
	if (workloadFingerprint === undefined) {
		return { sql: SLOW_START_SQL, bindings };
	}
	return {
		sql: `${SLOW_START_SQL} AND NOT EXISTS (
			SELECT 1 FROM (${WORKLOAD_PAIRING_SQL}
				AND event."machineId" = machine.id AND event."workloadFingerprint" = ?) pairing
			WHERE ${EXCLUDED_PAIRING_SQL}
		)`,
		bindings: [...bindings, workloadFingerprint],
	};
}

export async function machineExcludedWorkloadCount(
	manager: EntityManager,
	machineId: string
): Promise<number> {
	const [row] = await manager.execute<{ excluded: string }[]>(
		`SELECT COUNT(*) AS excluded FROM (${WORKLOAD_PAIRING_SQL}
			AND event."machineId" = ? AND event."workloadFingerprint" IS NOT NULL
			GROUP BY event."workloadFingerprint") pairing
		WHERE ${EXCLUDED_PAIRING_SQL}`,
		[machineId]
	);
	return Number(row?.excluded ?? 0);
}
