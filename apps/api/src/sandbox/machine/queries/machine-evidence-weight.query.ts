/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	HALF_LIFE_DECAY_BASE,
	MACHINE_TRUST_POLICY,
} from '../../../billing/constants/machine-trust.constants';
import { SECONDS_PER_HOUR } from '../../../common/constants/time.constants';

const HALF_LIFE_SECONDS =
	MACHINE_TRUST_POLICY.evidenceHalfLifeHours * SECONDS_PER_HOUR;

export function evidenceWeightSql(observedAtColumn: string): string {
	return `LEAST(1, power(${HALF_LIFE_DECAY_BASE}, extract(epoch FROM (transaction_timestamp() - ${observedAtColumn})) / ${HALF_LIFE_SECONDS}))`;
}

export const EVIDENCE_WINDOW_START_SQL = `transaction_timestamp() - interval '${MACHINE_TRUST_POLICY.observationWindowDays} days'`;

export function wilsonLowerBoundSql(
	hits: string,
	samples: string,
	zScore: number
): string {
	const zSquared = zScore ** 2;
	return `(CASE WHEN COALESCE(${samples}, 0) > 0 THEN GREATEST(0,
		((${hits}) / (${samples}) + ${zSquared} / (2 * (${samples}))
			- ${zScore} * sqrt(((${hits}) / (${samples}) * (1 - (${hits}) / (${samples})) + ${zSquared} / (4 * (${samples}))) / (${samples})))
		/ (1 + ${zSquared} / (${samples}))) ELSE 0 END)`;
}

export function machineHostSql(machineAlias: string): string {
	return `${machineAlias}."organizationId"::text`;
}
