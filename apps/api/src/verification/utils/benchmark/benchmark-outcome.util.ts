/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { addDays, addMinutes } from '../../../common/utils/time.util';
import type { Job } from '../../../machine-job/entities/job.entity';
import { JobStatus } from '../../../machine-job/enums/job-status.enum';
import {
	BENCHMARK_FAILURE_DEFERRAL,
	BENCHMARK_JOB_ERROR_DEFERRAL,
	BENCHMARK_RETRY,
	BENCHMARK_VALIDITY,
	type BenchmarkFailure,
} from '../../constants/benchmark-policy.constants';
import type { MachineBenchmark } from '../../entities/machine-benchmark.entity';
import { BenchmarkDeferralReason } from '../../enums/benchmark-deferral-reason.enum';
import { BenchmarkState } from '../../enums/benchmark-state.enum';

export function jobDeferralReason(
	job: Pick<Job, 'status' | 'executionResult'>
): BenchmarkDeferralReason | null {
	if (job.status !== JobStatus.FAILED) return null;
	const result = job.executionResult;
	if (!result) return BenchmarkDeferralReason.RETRYABLE_FAILURE;
	const mapped = BENCHMARK_JOB_ERROR_DEFERRAL[result.errorCode];
	if (mapped) return mapped;
	return result.retryable ? BenchmarkDeferralReason.RETRYABLE_FAILURE : null;
}

export function failureDeferralReason(
	failures: readonly BenchmarkFailure[]
): BenchmarkDeferralReason | null {
	const reasons = new Set(
		failures.map((failure) => BENCHMARK_FAILURE_DEFERRAL[failure])
	);
	if (reasons.size !== 1) return null;
	const [reason] = reasons;
	return reason ?? null;
}

function benchmarkRetryDelayMinutes(attempt: number): number {
	const exponential =
		BENCHMARK_RETRY.BASE_DELAY_MINUTES *
		BENCHMARK_RETRY.BACKOFF_FACTOR ** (attempt - 1);
	const capped = Math.min(exponential, BENCHMARK_RETRY.MAXIMUM_DELAY_MINUTES);
	const jitter = (Math.random() * 2 - 1) * BENCHMARK_RETRY.JITTER_RATIO;
	return capped * (1 + jitter);
}

export function deferBenchmark(
	benchmark: MachineBenchmark,
	reason: BenchmarkDeferralReason,
	deferredAt: Date
): void {
	benchmark.state = BenchmarkState.DEFERRED;
	benchmark.deferralReason = reason;
	benchmark.completedAt = deferredAt;
	benchmark.nextAttemptAt = addMinutes(
		deferredAt,
		benchmarkRetryDelayMinutes(benchmark.attempt)
	);
}

export function benchmarkValidUntil(completedAt: Date): Date {
	return addDays(completedAt, BENCHMARK_VALIDITY.TTL_DAYS);
}

export function benchmarkCurrent(validUntil: Date | null, now: Date): boolean {
	return validUntil !== null && validUntil > now;
}

export function benchmarkRenewalHorizon(now: Date): Date {
	return addDays(now, BENCHMARK_VALIDITY.RENEWAL_LEAD_DAYS);
}
