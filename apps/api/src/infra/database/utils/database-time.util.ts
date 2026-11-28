/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';

export async function databaseNow(manager: EntityManager): Promise<Date> {
	const rows = await manager.execute<{ now: unknown }[]>(
		'SELECT transaction_timestamp() AS now'
	);
	return parseDatabaseTimestamp(rows[0]?.now);
}

export function parseDatabaseTimestamp(databaseValue: unknown): Date {
	const now = toDate(databaseValue);
	if (!now || !Number.isFinite(now.getTime())) {
		throw new Error('Database query did not return a valid timestamp');
	}
	return now;
}

function toDate(value: unknown): Date | null {
	if (value instanceof Date) return value;
	return typeof value === 'string' ? new Date(value) : null;
}
