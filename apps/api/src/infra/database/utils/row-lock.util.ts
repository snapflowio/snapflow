/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityName, FilterQuery } from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/postgresql';

const ROW_LOCK_BATCH_SIZE = 1_000;

export const NO_KEY_UPDATE_LOCK = 'FOR NO KEY UPDATE';

export const KEY_SHARE_LOCK = 'FOR KEY SHARE';

type RowLockClause = typeof NO_KEY_UPDATE_LOCK | typeof KEY_SHARE_LOCK;

export function idBatches(ids: Iterable<string>): string[][] {
	const sorted = [...new Set(ids)].sort();
	const batches: string[][] = [];
	for (let offset = 0; offset < sorted.length; offset += ROW_LOCK_BATCH_SIZE) {
		batches.push(sorted.slice(offset, offset + ROW_LOCK_BATCH_SIZE));
	}
	return batches;
}

export async function lockRowIdsForNoKeyUpdate<Entity extends { id: string }>(
	manager: EntityManager,
	entity: EntityName<Entity>,
	ids: Iterable<string>
): Promise<void> {
	for (const batch of idBatches(ids)) {
		await lockBatch(manager, entity, batch, NO_KEY_UPDATE_LOCK);
	}
}

export async function lockRowIdsForKeyShare<Entity extends { id: string }>(
	manager: EntityManager,
	entity: EntityName<Entity>,
	ids: Iterable<string>
): Promise<void> {
	for (const batch of idBatches(ids)) {
		await lockBatch(manager, entity, batch, KEY_SHARE_LOCK);
	}
}

export async function lockRowsForNoKeyUpdate<Entity extends { id: string }>(
	manager: EntityManager,
	entity: EntityName<Entity>,
	ids: Iterable<string>,
	where?: FilterQuery<Entity>
): Promise<Entity[]> {
	const locked: Entity[] = [];
	for (const batch of idBatches(ids)) {
		await lockBatch(manager, entity, batch, NO_KEY_UPDATE_LOCK);
		const filter = { $and: [{ id: { $in: batch } }, where ?? {}] };
		locked.push(
			...(await manager.find(entity, filter as FilterQuery<Entity>, {
				refresh: true,
			}))
		);
	}
	return locked.sort((left, right) => (left.id < right.id ? -1 : 1));
}

async function lockBatch<Entity extends { id: string }>(
	manager: EntityManager,
	entity: EntityName<Entity>,
	batch: readonly string[],
	clause: RowLockClause
): Promise<void> {
	const metadata = manager.getMetadata(entity);
	const table = manager.getPlatform().quoteIdentifier(metadata.tableName);
	const [primaryKey] = metadata.primaryKeys;
	const [idColumnType] = metadata.properties[primaryKey].columnTypes;
	await manager.execute(
		`SELECT 1 FROM ${table} WHERE id = ANY(ARRAY[?]::${idColumnType}[]) ORDER BY id ${clause}`,
		[batch]
	);
}
