/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MicroUsd } from '../../common/values/micro-usd.value';
import { BillingBudgetMode } from '../constants/billing.constants';
import type { BillingBudget } from '../entities/billing-budget.entity';

export type BillingBudgetPolicy = Pick<
	BillingBudget,
	'mode' | 'monthlyLimitMicroUsd' | 'networkLimitMicroUsd'
>;

export interface BillingBudgetLimits {
	monthlyLimitMicroUsd: MicroUsd | null;
	networkLimitMicroUsd: MicroUsd | null;
}

const NO_BUDGET_LIMITS: BillingBudgetLimits = {
	monthlyLimitMicroUsd: null,
	networkLimitMicroUsd: null,
};

export function budgetLimits(
	budget: BillingBudgetPolicy | null
): BillingBudgetLimits {
	if (!budget) return NO_BUDGET_LIMITS;
	return {
		monthlyLimitMicroUsd: MicroUsd.parse(budget.monthlyLimitMicroUsd),
		networkLimitMicroUsd: MicroUsd.parseNullable(budget.networkLimitMicroUsd),
	};
}

export function blockingBudgetLimits(
	budget: BillingBudgetPolicy | null
): BillingBudgetLimits {
	const limits = budgetLimits(budget);
	return {
		monthlyLimitMicroUsd:
			budget?.mode === BillingBudgetMode.BLOCK_NEW
				? limits.monthlyLimitMicroUsd
				: null,
		networkLimitMicroUsd: limits.networkLimitMicroUsd,
	};
}
