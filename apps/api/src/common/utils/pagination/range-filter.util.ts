/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export function createRangeFilter<T>(minValue?: T, maxValue?: T) {
	if (minValue !== undefined && maxValue !== undefined) {
		return { $gte: minValue, $lte: maxValue };
	} else if (minValue !== undefined) {
		return { $gte: minValue };
	} else if (maxValue !== undefined) {
		return { $lte: maxValue };
	}
	return undefined;
}
