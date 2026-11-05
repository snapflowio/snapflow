/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { MicroUsd } from '../../../common/values/micro-usd.value';
import type {
	LinePrice,
	PriceTerms,
	UsageQuantities,
} from '../../../marketplace/types/pricing.types';
import {
	minimumQuantities,
	priceUsage,
} from '../../../marketplace/utils/pricing.util';
import { BillingReconciliationReason } from '../../constants/billing.constants';

export interface AttestedCharge {
	charged: LinePrice;
	creditMicroUsd: MicroUsd;
}

export function attestedCharge(
	terms: PriceTerms,
	intended: UsageQuantities,
	attested: UsageQuantities
): AttestedCharge {
	const intendedPrice = priceUsage(terms, intended);
	const charged = priceUsage(terms, minimumQuantities(intended, attested));
	return {
		charged,
		creditMicroUsd: intendedPrice.grossMicroUsd.subtract(charged.grossMicroUsd),
	};
}

export function attestationReason(
	charge: AttestedCharge
): BillingReconciliationReason | null {
	if (charge.creditMicroUsd.isZero()) return null;
	return charge.charged.grossMicroUsd.isZero()
		? BillingReconciliationReason.UNATTESTED
		: BillingReconciliationReason.PARTIALLY_ATTESTED;
}
