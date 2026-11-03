/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityName, QueryResult } from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/postgresql';

export interface BatchedPruneTarget<Entity extends object> {
	entity: EntityName<Entity>;
	where: string;
	bindings: readonly unknown[];
	orderBy?: string;
	batchSize: number;
	maximumBatches: number;
}

export async function pruneInBatches<Entity extends object>(
	manager: EntityManager,
	target: BatchedPruneTarget<Entity>
): Promise<number> {
	const table = manager.getMetadata().get(target.entity).tableName;
	const ordering = target.orderBy ? `ORDER BY ${target.orderBy}` : '';
	const statement = `DELETE FROM "${table}" WHERE ctid = ANY(ARRAY(
		SELECT target.ctid FROM "${table}" target
		WHERE ${target.where}
		${ordering}
		LIMIT ?
		FOR UPDATE SKIP LOCKED
	))`;
	let deleted = 0;
	for (let batch = 0; batch < target.maximumBatches; batch += 1) {
		const result = await manager
			.getConnection()
			.execute<QueryResult>(
				statement,
				[...target.bindings, target.batchSize],
				'run'
			);
		deleted += result.affectedRows;
		if (result.affectedRows < target.batchSize) break;
	}
	return deleted;
}
