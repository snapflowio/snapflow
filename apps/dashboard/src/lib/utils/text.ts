/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

const WORD_SEPARATORS = /[-_\s]+/;

export function titleCase(value: string): string {
	return value
		.split(WORD_SEPARATORS)
		.filter(Boolean)
		.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
		.join(' ');
}

export function sentenceCase(value: string): string {
	const label = value.replaceAll('_', ' ');
	return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

export function pluralize(
	count: number,
	singular: string,
	plural = `${singular}s`
): string {
	return `${count} ${count === 1 ? singular : plural}`;
}
