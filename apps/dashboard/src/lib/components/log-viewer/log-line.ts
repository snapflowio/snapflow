/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export type LogLevel = 'error' | 'warn' | 'info';

export interface LogLine {
	number: number;
	text: string;
	level: LogLevel;
}

const ERROR_PATTERN = /\b(error|err|fatal|panic|failed|exception)\b/i;
const WARN_PATTERN = /\b(warn|warning|deprecated)\b/i;

export function logLevel(text: string): LogLevel {
	if (ERROR_PATTERN.test(text)) return 'error';
	if (WARN_PATTERN.test(text)) return 'warn';
	return 'info';
}

export function parseLogLines(lines: readonly string[]): LogLine[] {
	return lines.map((text, index) => ({
		number: index + 1,
		text,
		level: logLevel(text),
	}));
}

export function filterLogLines(
	lines: readonly LogLine[],
	query: string
): LogLine[] {
	const needle = query.trim().toLowerCase();
	if (!needle) return [...lines];
	return lines.filter((line) => line.text.toLowerCase().includes(needle));
}

export function countLevel(lines: readonly LogLine[], level: LogLevel): number {
	return lines.reduce(
		(total, line) => total + (line.level === level ? 1 : 0),
		0
	);
}
