/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

const QUOTE = '"';
const ESCAPED_QUOTE = '""';
const FIELD_SEPARATOR = ',';
const RECORD_SEPARATOR = '\r\n';
const BYTE_ORDER_MARK = '﻿';
const FORMULA_PREFIX = "'";
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;
const NUMBER = /^-?\d+(\.\d+)?$/;

export type CsvRow = Readonly<Record<string, string>>;

interface CsvOptions {
	byteOrderMark?: boolean;
}

function csvField(value: string): string {
	const inert =
		FORMULA_TRIGGER.test(value) && !NUMBER.test(value)
			? `${FORMULA_PREFIX}${value}`
			: value;
	return `${QUOTE}${inert.replaceAll(QUOTE, ESCAPED_QUOTE)}${QUOTE}`;
}

export function csvDocument(
	rows: readonly CsvRow[],
	{ byteOrderMark = false }: CsvOptions = {}
): string {
	const [first] = rows;
	if (!first) return '';
	const columns = Object.keys(first);
	const records = [
		columns.map(csvField).join(FIELD_SEPARATOR),
		...rows.map((row) =>
			columns.map((column) => csvField(row[column] ?? '')).join(FIELD_SEPARATOR)
		),
	].join(RECORD_SEPARATOR);
	return byteOrderMark ? `${BYTE_ORDER_MARK}${records}` : records;
}
