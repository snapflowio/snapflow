/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import type { JobErrorCode } from '../../machine-job/enums/job-error-code.enum';
import {
	MACHINE_RELIABILITY_EVENT_KIND,
	MACHINE_RELIABILITY_OUTCOME,
} from '../constants/machine-reliability.constants';

const CONSECUTIVE_FAILURES_SQL = `SELECT count(*)::int AS failures
	FROM machine_reliability_event event
	WHERE event."sandboxId" = ? AND event."eventKind" = ? AND event."reasonCode" = ?
		AND event."observedAt" > COALESCE((
			SELECT max(success."observedAt") FROM machine_reliability_event success
			WHERE success."sandboxId" = ? AND success."eventKind" = ? AND success.outcome = ?
		), '-infinity'::timestamptz)`;

interface FailureCountRow {
	failures: number;
}

export async function consecutiveConvergenceFailures(
	manager: EntityManager,
	sandboxId: string,
	reasonCode: JobErrorCode
): Promise<number> {
	const kind = MACHINE_RELIABILITY_EVENT_KIND.SANDBOX_CONVERGENCE;
	const [row] = await manager.execute<FailureCountRow[]>(
		CONSECUTIVE_FAILURES_SQL,
		[
			sandboxId,
			kind,
			reasonCode,
			sandboxId,
			kind,
			MACHINE_RELIABILITY_OUTCOME.SUCCESS,
		]
	);
	return row?.failures ?? 0;
}
