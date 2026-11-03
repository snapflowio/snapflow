/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BENCHMARK_INTEGRITY_FAILURES } from '../constants/benchmark-policy.constants';
import type { MachineBenchmark } from '../entities/machine-benchmark.entity';
import { BenchmarkState } from '../enums/benchmark-state.enum';

export function hasIntegrityFailure(failures: readonly string[]): boolean {
	return failures.some((failure) => BENCHMARK_INTEGRITY_FAILURES.has(failure));
}

export function benchmarkStanding(
	latestPassedBenchmarkId: string | null,
	latestSettled: Pick<MachineBenchmark, 'state' | 'failureReasons'> | null
): boolean {
	return (
		latestPassedBenchmarkId !== null &&
		!(
			latestSettled?.state === BenchmarkState.FAILED &&
			hasIntegrityFailure(latestSettled.failureReasons)
		)
	);
}
