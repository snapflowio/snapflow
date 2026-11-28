/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	BenchmarkDeferral,
	BenchmarkFailureDetail,
	MachineBenchmark,
} from '@snapflow/api-client';
import { formatDateTime } from '#lib/utils/format.ts';

export function benchmarkDeferralTitle(
	deferral: BenchmarkDeferral,
	nextAttemptAt: MachineBenchmark['nextAttemptAt']
): string {
	const deferred = `Benchmark deferred: ${deferral.summary}.`;
	return nextAttemptAt
		? `${deferred} Retrying automatically at ${formatDateTime(nextAttemptAt)}.`
		: deferred;
}

export function benchmarkFailureTitle(failure: BenchmarkFailureDetail): string {
	return `Benchmark failed: ${failure.summary}.`;
}

export function benchmarkExpired(expiresAt: string): boolean {
	return new Date(expiresAt).getTime() <= Date.now();
}
