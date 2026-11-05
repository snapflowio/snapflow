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
import { MicroUsd } from '../../common/values/micro-usd.value';
import {
	networkBudgetExhausted,
	reachedBudgetThresholds,
} from './network-budget.util';

const LIMIT = MicroUsd.of(10_000_000n);

describe('network budget thresholds', () => {
	it('alerts at 50, 80 and 100 percent of the network budget', () => {
		assert.deepEqual(
			reachedBudgetThresholds(MicroUsd.of(4_999_999n), LIMIT),
			[]
		);
		assert.deepEqual(
			reachedBudgetThresholds(MicroUsd.of(5_000_000n), LIMIT),
			[5_000]
		);
		assert.deepEqual(
			reachedBudgetThresholds(MicroUsd.of(8_000_000n), LIMIT),
			[5_000, 8_000]
		);
		assert.deepEqual(
			reachedBudgetThresholds(MicroUsd.of(12_000_000n), LIMIT),
			[5_000, 8_000, 10_000]
		);
	});

	it('throttles only once spend reaches the whole budget', () => {
		assert.equal(networkBudgetExhausted(MicroUsd.of(9_999_999n), LIMIT), false);
		assert.equal(networkBudgetExhausted(LIMIT, LIMIT), true);
	});
});
