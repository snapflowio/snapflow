/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { mock } from 'node:test';
import { EntityManager } from '@mikro-orm/postgresql';
import { fakeInstance } from '../../../common/testing/instance.fake';

type EntityClass = abstract new () => object;
type Condition = Record<string, unknown>;

export class InMemoryEntityManager {
	readonly manager = fakeInstance(EntityManager);
	private readonly rows = new Map<EntityClass, object[]>();

	constructor(now: Date) {
		mock.method(this.manager, 'execute', async () => [{ now }]);
		mock.method(
			this.manager,
			'find',
			async (entity: EntityClass, where: Condition) =>
				this.of(entity).filter((row) => matches(row, where))
		);
		mock.method(
			this.manager,
			'findOne',
			async (entity: EntityClass, where: Condition) =>
				this.of(entity).find((row) => matches(row, where)) ?? null
		);
		mock.method(this.manager, 'create', (entity: EntityClass, data: object) =>
			Object.assign(Object.create(entity.prototype), data)
		);
		mock.method(this.manager, 'persist', (row: object) => {
			this.add(row);
			return this.manager;
		});
	}

	add(...rows: object[]): void {
		for (const row of rows) {
			const entity = row.constructor as EntityClass;
			this.rows.set(entity, [...this.of(entity), row]);
		}
	}

	of<T extends object>(entity: abstract new () => T): T[] {
		return (this.rows.get(entity) ?? []) as T[];
	}
}

function matches(row: object, where: Condition): boolean {
	const record = row as Record<string, unknown>;
	return Object.entries(where).every(([key, condition]) =>
		satisfies(record[key], condition)
	);
}

function satisfies(value: unknown, condition: unknown): boolean {
	if (condition === null || typeof condition !== 'object') {
		return value === condition || (condition === null && value === undefined);
	}
	if (condition instanceof Date) {
		return value instanceof Date && value.getTime() === condition.getTime();
	}
	const operators = condition as {
		$in?: unknown[];
		$gt?: Date;
		$lte?: Date;
	};
	return (
		(operators.$in === undefined || operators.$in.includes(value)) &&
		(operators.$gt === undefined ||
			(value instanceof Date && value > operators.$gt)) &&
		(operators.$lte === undefined ||
			(value instanceof Date && value <= operators.$lte))
	);
}
