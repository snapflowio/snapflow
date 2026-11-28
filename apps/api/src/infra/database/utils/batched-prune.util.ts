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

export interface BatchedUpdateTarget<Entity extends object>
	extends BatchedPruneTarget<Entity> {
	assignments: string;
}

async function runInBatches<Entity extends object>(
	manager: EntityManager,
	target: BatchedPruneTarget<Entity>,
	statement: (table: string, batchRows: string) => string
): Promise<number> {
	const table = manager.getMetadata().get(target.entity).tableName;
	const ordering = target.orderBy ? `ORDER BY ${target.orderBy}` : '';
	const sql = statement(
		table,
		`ctid = ANY(ARRAY(
		SELECT target.ctid FROM "${table}" target
		WHERE ${target.where}
		${ordering}
		LIMIT ?
		FOR UPDATE SKIP LOCKED
	))`
	);
	let affected = 0;
	for (let batch = 0; batch < target.maximumBatches; batch += 1) {
		const result = await manager
			.getConnection()
			.execute<QueryResult>(sql, [...target.bindings, target.batchSize], 'run');
		affected += result.affectedRows;
		if (result.affectedRows < target.batchSize) break;
	}
	return affected;
}

export function pruneInBatches<Entity extends object>(
	manager: EntityManager,
	target: BatchedPruneTarget<Entity>
): Promise<number> {
	return runInBatches(
		manager,
		target,
		(table, batchRows) => `DELETE FROM "${table}" WHERE ${batchRows}`
	);
}

export function updateInBatches<Entity extends object>(
	manager: EntityManager,
	target: BatchedUpdateTarget<Entity>
): Promise<number> {
	return runInBatches(
		manager,
		target,
		(table, batchRows) =>
			`UPDATE "${table}" SET ${target.assignments} WHERE ${batchRows}`
	);
}
