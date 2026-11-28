/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { RealtimeOutboxStatus } from '../constants/realtime-outbox.constants';

export const REALTIME_OUTBOX_BACKLOG_STATUSES = [
	RealtimeOutboxStatus.PENDING,
	RealtimeOutboxStatus.PROCESSING,
	RealtimeOutboxStatus.FAILED,
] as const;

type RealtimeOutboxBacklogStatus =
	(typeof REALTIME_OUTBOX_BACKLOG_STATUSES)[number];

const BACKLOG_SQL = `
	SELECT status,
	       count(*)::int AS events,
	       coalesce(extract(epoch FROM now() - min("createdAt")), 0)::float8 AS "oldestAgeSeconds"
	FROM realtime_outbox_event
	WHERE status = ANY(ARRAY[?]::text[])
	GROUP BY status`;

export interface RealtimeOutboxBacklogRow {
	status: RealtimeOutboxBacklogStatus;
	events: number;
	oldestAgeSeconds: number;
}

export function realtimeOutboxBacklog(
	manager: EntityManager
): Promise<RealtimeOutboxBacklogRow[]> {
	return manager.execute<RealtimeOutboxBacklogRow[]>(BACKLOG_SQL, [
		[...REALTIME_OUTBOX_BACKLOG_STATUSES],
	]);
}
