/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

function toUint64(value: number): bigint {
	if (!Number.isSafeInteger(value) || value < 0) {
		throw new RangeError(`${value} is not a non-negative safe integer`);
	}
	return BigInt(value);
}

export function optionalUint64(
	value: number | null | undefined
): bigint | undefined {
	return value === null || value === undefined ? undefined : toUint64(value);
}
