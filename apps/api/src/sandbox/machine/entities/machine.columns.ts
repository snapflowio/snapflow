/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const MACHINE_MEASUREMENT_COLUMN = Object.freeze({
	type: 'number',
	columnType: 'double precision',
	default: 0,
} as const);

export const MACHINE_COUNTER_COLUMN = Object.freeze({
	type: 'integer',
	columnType: 'integer',
	default: 0,
} as const);

export const MACHINE_OPTIONAL_TIMESTAMP_COLUMN = Object.freeze({
	type: 'datetime',
	columnType: 'timestamptz(3)',
	nullable: true,
} as const);

export const MACHINE_OPTIONAL_INTEGER_COLUMN = Object.freeze({
	type: 'integer',
	columnType: 'integer',
	nullable: true,
} as const);

export const MACHINE_OPTIONAL_MEASUREMENT_COLUMN = Object.freeze({
	type: 'number',
	columnType: 'double precision',
	nullable: true,
} as const);

export const MACHINE_OPTIONAL_STRING_COLUMN = Object.freeze({
	type: 'string',
	columnType: 'varchar',
	nullable: true,
} as const);
