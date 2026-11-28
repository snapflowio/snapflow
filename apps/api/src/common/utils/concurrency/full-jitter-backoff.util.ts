/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export interface FullJitterBackoff {
	readonly baseMilliseconds: number;
	readonly capMilliseconds: number;
}

export function fullJitterBackoffMilliseconds(
	attempt: number,
	backoff: FullJitterBackoff,
	random: () => number = Math.random
): number {
	const exponential = backoff.baseMilliseconds * 2 ** Math.max(0, attempt);
	return Math.floor(random() * Math.min(backoff.capMilliseconds, exponential));
}
