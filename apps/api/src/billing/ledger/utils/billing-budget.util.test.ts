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
import { MicroUsd } from '../../../common/values/micro-usd.value';
import { BillingBudgetMode } from '../constants/billing.constants';
import { blockingBudgetLimits, budgetLimits } from './billing-budget.util';

const budget = {
	mode: BillingBudgetMode.BLOCK_NEW,
	monthlyLimitMicroUsd: '100',
	networkLimitMicroUsd: '10',
};

describe('budget limits', () => {
	it('reports configured limits in every mode', () => {
		const expected = {
			monthlyLimitMicroUsd: MicroUsd.of(100n),
			networkLimitMicroUsd: MicroUsd.of(10n),
		};
		assert.deepEqual(budgetLimits(budget), expected);
		assert.deepEqual(
			budgetLimits({ ...budget, mode: BillingBudgetMode.ALERT }),
			expected
		);
		assert.deepEqual(budgetLimits({ ...budget, networkLimitMicroUsd: null }), {
			monthlyLimitMicroUsd: MicroUsd.of(100n),
			networkLimitMicroUsd: null,
		});
	});

	it('blocks on the monthly limit only with a block-new budget', () => {
		assert.deepEqual(blockingBudgetLimits(budget), {
			monthlyLimitMicroUsd: MicroUsd.of(100n),
			networkLimitMicroUsd: MicroUsd.of(10n),
		});
		assert.deepEqual(
			blockingBudgetLimits({ ...budget, mode: BillingBudgetMode.ALERT }),
			{ monthlyLimitMicroUsd: null, networkLimitMicroUsd: MicroUsd.of(10n) }
		);
		assert.deepEqual(blockingBudgetLimits(null), {
			monthlyLimitMicroUsd: null,
			networkLimitMicroUsd: null,
		});
	});
});
