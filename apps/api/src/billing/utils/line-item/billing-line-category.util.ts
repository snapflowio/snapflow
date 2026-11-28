/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { parseFixed } from '../../../common/utils/fixed-point.util';
import { USAGE_RESOURCE_SCALE } from '../../../usage/constants/usage-accounting.constants';
import { BillingLineCategory } from '../../constants/billing.constants';
import type { BillingLineItem } from '../../entities/billing-line-item.entity';
import type { BillingLineQuantities } from '../../schemas/billing-line-quantities.schema';

const RUNNING_QUANTITY = 'runningMillis' satisfies keyof BillingLineQuantities;

export const COMPUTE_BILLING_LINE_SQL = `(line.quantities IS NULL OR (line.quantities->>'${RUNNING_QUANTITY}')::numeric > 0)`;

export function billingLineCategory(
	line: Pick<BillingLineItem, 'quantities'>
): BillingLineCategory {
	return line.quantities === null ||
		parseFixed(
			line.quantities[RUNNING_QUANTITY],
			USAGE_RESOURCE_SCALE,
			RUNNING_QUANTITY
		) > 0n
		? BillingLineCategory.COMPUTE
		: BillingLineCategory.STORAGE;
}
