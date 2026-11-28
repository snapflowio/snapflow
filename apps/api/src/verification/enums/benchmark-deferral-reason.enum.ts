/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export enum BenchmarkDeferralReason {
	MACHINE_BUSY = 'machine_busy',
	INSUFFICIENT_CAPACITY = 'insufficient_capacity',
	DEADLINE_EXCEEDED = 'deadline_exceeded',
	SPEEDTEST_UNAVAILABLE = 'speedtest_unavailable',
	CHALLENGE_EXPIRED = 'challenge_expired',
	RETRYABLE_FAILURE = 'retryable_failure',
}
