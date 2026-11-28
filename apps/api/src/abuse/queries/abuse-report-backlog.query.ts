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
	type AbuseReportCategory,
	OPEN_REPORT_STATUSES,
} from '../constants/abuse-report.constants';

const BACKLOG_SQL = `
	SELECT category,
		count(*)::integer AS open,
		(count(*) FILTER (WHERE "dueAt" < now() AND "counterNoticeReceivedAt" IS NULL))::integer AS overdue
	FROM abuse_report
	WHERE status = ANY(ARRAY[?]::varchar[])
	GROUP BY category`;

export async function abuseReportBacklog(manager: EntityManager) {
	return manager.execute<
		{ category: AbuseReportCategory; open: number; overdue: number }[]
	>(BACKLOG_SQL, [[...OPEN_REPORT_STATUSES]]);
}
