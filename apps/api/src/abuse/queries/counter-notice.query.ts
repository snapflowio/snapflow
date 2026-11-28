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
	AbuseReportCategory,
	SETTLED_REPORT_STATUSES,
} from '../constants/abuse-report.constants';
import { counterNoticeForwardDueAt } from '../utils/dmca-restoration.util';

function restorableReport(alias: string): string {
	return `${alias}.category = ?
		AND ${alias}."restoreAfter" <= now()
		AND ${alias}."restoredAt" IS NULL
		AND ${alias}."courtActionFiledAt" IS NULL`;
}

const RESTORABLE_CASES_SQL = `
	SELECT DISTINCT candidate."abuseCaseId" AS "caseId"
	FROM abuse_report candidate
	WHERE candidate."abuseCaseId" IS NOT NULL
	  AND ${restorableReport('candidate')}
	  AND NOT EXISTS (
		SELECT 1 FROM abuse_report other
		WHERE other."abuseCaseId" = candidate."abuseCaseId"
		  AND other.status <> ALL(ARRAY[?]::varchar[])
		  AND NOT (${restorableReport('other')})
	  )
	LIMIT ?`;

const PAST_RESTORE_BY_SQL = `
	SELECT count(*)::integer AS count
	FROM abuse_report
	WHERE "restoreBy" < now()
	  AND "restoredAt" IS NULL
	  AND "courtActionFiledAt" IS NULL`;

const UNFORWARDED_SQL = `
	SELECT "counterNoticeReceivedAt" AS "receivedAt", now() AS now
	FROM abuse_report
	WHERE "counterNoticeReceivedAt" IS NOT NULL
	  AND "counterNoticeForwardedAt" IS NULL
	  AND "restoredAt" IS NULL
	  AND "courtActionFiledAt" IS NULL`;

export async function restorableCounterNoticeCases(
	manager: EntityManager,
	limit: number
): Promise<string[]> {
	const rows = await manager.execute<{ caseId: string }[]>(
		RESTORABLE_CASES_SQL,
		[
			AbuseReportCategory.COPYRIGHT,
			[...SETTLED_REPORT_STATUSES],
			AbuseReportCategory.COPYRIGHT,
			limit,
		]
	);
	return rows.map(({ caseId }) => caseId);
}

export async function counterNoticesPastRestoreBy(
	manager: EntityManager
): Promise<number> {
	const [row] = await manager.execute<{ count: number }[]>(PAST_RESTORE_BY_SQL);
	return row?.count ?? 0;
}

export async function counterNoticesForwardOverdue(
	manager: EntityManager
): Promise<number> {
	const rows =
		await manager.execute<{ receivedAt: Date; now: Date }[]>(UNFORWARDED_SQL);
	return rows.filter(
		({ receivedAt, now }) => counterNoticeForwardDueAt(receivedAt) < now
	).length;
}
