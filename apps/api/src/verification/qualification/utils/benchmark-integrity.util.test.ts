/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BENCHMARK_FAILURE } from '../constants/benchmark-policy.constants';
import { BenchmarkState } from '../enums/benchmark-state.enum';
import { benchmarkStanding } from './benchmark-integrity.util';

const PASSED_BENCHMARK_ID = 'benchmark-1';

describe('benchmark standing', () => {
	it('requires a passed benchmark', () => {
		assert.equal(benchmarkStanding(null, null), false);
	});

	it('keeps the standing through an operational failure', () => {
		assert.equal(
			benchmarkStanding(PASSED_BENCHMARK_ID, {
				state: BenchmarkState.FAILED,
				failureReasons: [BENCHMARK_FAILURE.JOB_FAILED],
			}),
			true
		);
	});

	it('loses the standing on an integrity failure', () => {
		assert.equal(
			benchmarkStanding(PASSED_BENCHMARK_ID, {
				state: BenchmarkState.FAILED,
				failureReasons: [BENCHMARK_FAILURE.CPU_PROOF_INVALID],
			}),
			false
		);
	});
});
