/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export type ResourceSortDirection = 'asc' | 'desc';

export interface ResourceSortState {
	column: string;
	direction: ResourceSortDirection;
}

function sortableValue(value: unknown): string | number {
	if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
	return value == null ? '' : String(value);
}

export function compareValues(left: unknown, right: unknown): number {
	const normalizedLeft = sortableValue(left);
	const normalizedRight = sortableValue(right);
	if (
		typeof normalizedLeft === 'number' &&
		typeof normalizedRight === 'number'
	) {
		return normalizedLeft - normalizedRight;
	}

	return String(normalizedLeft).localeCompare(
		String(normalizedRight),
		undefined,
		{ numeric: true, sensitivity: 'base' }
	);
}

export function ariaSort(
	sort: ResourceSortState | undefined,
	columnId: string
): 'ascending' | 'descending' | undefined {
	if (sort?.column !== columnId) return undefined;
	return sort.direction === 'asc' ? 'ascending' : 'descending';
}
