/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BENCHMARK_FAILURE_GUIDANCE } from '../../constants/benchmark-guidance.constants';
import {
	BENCHMARK_FAILURE,
	type BenchmarkFailure,
} from '../../constants/benchmark-policy.constants';
import type { BenchmarkGuidance } from '../../types/benchmark.types';

function isBenchmarkFailure(code: string): code is BenchmarkFailure {
	return Object.hasOwn(BENCHMARK_FAILURE_GUIDANCE, code);
}

export function benchmarkFailureCode(code: string): BenchmarkFailure {
	return isBenchmarkFailure(code) ? code : BENCHMARK_FAILURE.JOB_FAILED;
}

export function benchmarkFailureGuidance(code: string): BenchmarkGuidance {
	return BENCHMARK_FAILURE_GUIDANCE[benchmarkFailureCode(code)];
}
