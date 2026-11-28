/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const timestampColumn = (fieldName: string) =>
	({ type: 'datetime', columnType: 'timestamptz(3)', fieldName }) as const;

export const integerColumn = (fieldName: string) =>
	({ type: 'integer', columnType: 'integer', fieldName }) as const;

export const varcharColumn = (fieldName: string) =>
	({ type: 'string', columnType: 'varchar', fieldName }) as const;

export const textColumn = (fieldName: string) =>
	({ type: 'text', columnType: 'text', fieldName }) as const;

export const booleanColumn = (fieldName: string) =>
	({ type: 'boolean', columnType: 'boolean', fieldName }) as const;

export const jsonColumn = (fieldName: string) =>
	({ type: 'json', columnType: 'jsonb', fieldName }) as const;

export const uuidColumn = (fieldName: string) =>
	({ type: 'uuid', columnType: 'uuid', fieldName }) as const;

export const uuidPrimaryKey = {
	type: 'uuid',
	columnType: 'uuid',
	defaultRaw: 'gen_random_uuid()',
} as const;

export const createdAtColumn = {
	...timestampColumn('createdAt'),
	defaultRaw: 'now()',
	onCreate: () => new Date(),
} as const;

export const updatedAtColumn = {
	...createdAtColumn,
	fieldName: 'updatedAt',
	onUpdate: () => new Date(),
} as const;
