/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { parse as parseEnv } from 'envfile';

export interface KeyValueRow {
	id: string;
	key: string;
	value: string;
}

export type KeyValueRowProperty = 'key' | 'value';

type CreateRowId = () => string;

const LINE_BREAK = /\r?\n/;
const SEPARATOR = '=';

export function emptyRow(createId: CreateRowId): KeyValueRow {
	return { id: createId(), key: '', value: '' };
}

function isFilled(row: KeyValueRow): boolean {
	return Boolean(row.key.trim() || row.value);
}

export function filledRows(rows: readonly KeyValueRow[]): KeyValueRow[] {
	return rows.filter(isFilled);
}

export function parseRows(value: string, createId: CreateRowId): KeyValueRow[] {
	const rows = value
		.split(LINE_BREAK)
		.filter((line) => line.trim())
		.map((line) => {
			const separatorIndex = line.indexOf(SEPARATOR);
			return {
				id: createId(),
				key: (separatorIndex < 0 ? line : line.slice(0, separatorIndex)).trim(),
				value: separatorIndex < 0 ? '' : line.slice(separatorIndex + 1),
			};
		});
	return rows.length > 0 ? rows : [emptyRow(createId)];
}

export function parseEnvRows(
	text: string,
	createId: CreateRowId
): KeyValueRow[] {
	return Object.entries(parseEnv(text)).map(([key, value]) => ({
		id: createId(),
		key,
		value,
	}));
}

export function serializeRows(rows: readonly KeyValueRow[]): string {
	return filledRows(rows)
		.map((row) => `${row.key.trim()}${SEPARATOR}${row.value}`)
		.join('\n');
}
