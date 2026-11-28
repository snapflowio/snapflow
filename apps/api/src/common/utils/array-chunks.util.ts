/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export function chunks<Item>(items: readonly Item[], size: number): Item[][] {
	const result: Item[][] = [];
	for (let offset = 0; offset < items.length; offset += size) {
		result.push(items.slice(offset, offset + size));
	}
	return result;
}
