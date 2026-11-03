/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BASIS_POINTS_DENOMINATOR } from '../../../common/constants/money.constants';
import type { MicroUsd } from '../../../common/values/micro-usd.value';
import { NETWORK_BUDGET } from '../constants/network-usage.constants';

export function reachedBudgetThresholds(
	spend: MicroUsd,
	limit: MicroUsd
): number[] {
	return NETWORK_BUDGET.ALERT_THRESHOLDS_BASIS_POINTS.filter(
		(threshold) =>
			spend.toBigInt() * BASIS_POINTS_DENOMINATOR >=
			limit.toBigInt() * BigInt(threshold)
	);
}

export function networkBudgetExhausted(
	spend: MicroUsd,
	limit: MicroUsd
): boolean {
	return spend.atLeast(limit);
}
