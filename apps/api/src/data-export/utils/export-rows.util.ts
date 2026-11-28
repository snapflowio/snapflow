/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	Cursor,
	EntityClass,
	FilterQuery,
	QueryOrderMap,
} from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/postgresql';

function pickFields<Entity extends object, Field extends keyof Entity & string>(
	row: Entity,
	fields: readonly Field[]
): Pick<Entity, Field> {
	return Object.fromEntries(fields.map((field) => [field, row[field]])) as Pick<
		Entity,
		Field
	>;
}

export async function exportRows<
	Entity extends object,
	Field extends keyof Entity & string,
>(
	manager: EntityManager,
	entity: EntityClass<Entity>,
	where: FilterQuery<NoInfer<Entity>>,
	fields: readonly Field[]
): Promise<Pick<Entity, Field>[]> {
	const rows = await manager.find(entity, where, {
		fields: [...fields] as never,
	});
	return rows.map((row) => pickFields(row, fields));
}

export async function exportRowsInPages<
	Entity extends object,
	Field extends keyof Entity & string,
>(
	manager: EntityManager,
	entity: EntityClass<Entity>,
	where: FilterQuery<NoInfer<Entity>>,
	fields: readonly Field[],
	orderBy: QueryOrderMap<NoInfer<Entity>>,
	pageSize: number
): Promise<Pick<Entity, Field>[]> {
	const rows: Pick<Entity, Field>[] = [];
	let after: string | null = null;
	do {
		const page: Cursor<Entity, never, never, never, false> =
			await manager.findByCursor(entity, {
				where,
				fields: [...fields] as never,
				orderBy,
				first: pageSize,
				includeCount: false,
				overfetch: true,
				disableIdentityMap: true,
				...(after ? { after } : {}),
			});
		for (const row of page) rows.push(pickFields(row, fields));
		after = page.hasNextPage ? page.endCursor : null;
	} while (after);
	return rows;
}
