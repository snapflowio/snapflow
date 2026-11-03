/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MicroUsd } from '../../../../common/values/micro-usd.value';
import { BillingAdjustmentKind } from '../../constants/billing.constants';
import type { BillingLineAdjustment } from '../../entities/billing-line-adjustment.entity';
import type { BillingLineItem } from '../../entities/billing-line-item.entity';

export function billingLineAmounts(
	line: Pick<BillingLineItem, 'grossMicroUsd'>,
	adjustments: readonly Pick<BillingLineAdjustment, 'amountMicroUsd' | 'kind'>[]
): { adjustmentMicroUsd: string; effectiveMicroUsd: string } {
	const adjustment = MicroUsd.sum(
		adjustments.map((entry) => {
			const amount = MicroUsd.parse(entry.amountMicroUsd);
			return entry.kind === BillingAdjustmentKind.DEBIT
				? amount
				: amount.negate();
		})
	);
	const effective = MicroUsd.parse(line.grossMicroUsd).add(adjustment);
	if (effective.isNegative()) {
		throw new Error('Billing line adjustments exceed the original charge');
	}
	return {
		adjustmentMicroUsd: adjustment.toString(),
		effectiveMicroUsd: effective.toString(),
	};
}
