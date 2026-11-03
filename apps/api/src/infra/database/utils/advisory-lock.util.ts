/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';

export async function lockAdvisoryKey(
	manager: EntityManager,
	key: string,
	namespace: number
): Promise<void> {
	await manager.execute(
		'SELECT pg_advisory_xact_lock(hashtextextended(?, ?))',
		[key, namespace]
	);
}
