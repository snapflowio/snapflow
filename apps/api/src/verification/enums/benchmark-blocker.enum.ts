/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export enum BenchmarkBlocker {
	MACHINE_NOT_READY = 'machine_not_ready',
	MACHINE_KEY_MISSING = 'machine_key_missing',
	BENCHMARK_PENDING = 'benchmark_pending',
	MACHINE_BUSY = 'machine_busy',
	DISK_UNAVAILABLE = 'disk_unavailable',
	SPEEDTEST_UNAVAILABLE = 'speedtest_unavailable',
}
