/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export function canonicalJson(value: unknown): string {
	if (
		value === null ||
		typeof value === 'string' ||
		typeof value === 'boolean'
	) {
		return JSON.stringify(value);
	}
	if (typeof value === 'number') {
		if (!Number.isFinite(value)) {
			throw new Error('Canonical JSON cannot encode a non-finite number');
		}
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) {
		return `[${value.map(canonicalJson).join(',')}]`;
	}
	if (typeof value === 'object') {
		const record = value as Record<string, unknown>;
		return `{${Object.keys(record)
			.sort()
			.map((key) => {
				if (record[key] === undefined) {
					throw new Error('Canonical JSON cannot encode undefined');
				}
				return `${JSON.stringify(key)}:${canonicalJson(record[key])}`;
			})
			.join(',')}}`;
	}
	throw new Error(`Canonical JSON cannot encode ${typeof value}`);
}
