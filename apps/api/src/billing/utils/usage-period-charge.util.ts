/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { millisecondsBetween } from '../../common/utils/time.util';
import type {
	LinePrice,
	PriceTerms,
} from '../../marketplace/types/pricing.types';
import { priceUsage } from '../../marketplace/utils/pricing.util';
import type { SandboxUsagePeriod } from '../../usage/entities/sandbox-usage-period.entity';
import {
	allocationUnits,
	intendedQuantities,
} from '../../usage/utils/usage-quantities.util';

export type AccruingUsagePeriod = Pick<
	SandboxUsagePeriod,
	'mode' | 'startAt' | 'cpu' | 'mem' | 'disk' | 'gpu'
>;

// What an open usage period has accrued from its start until observedAt, at
// its lease's price, before it is finalized into a billing line.
export function usagePeriodCharge(
	terms: PriceTerms,
	period: AccruingUsagePeriod,
	observedAt: Date
): LinePrice {
	const elapsed = BigInt(
		Math.max(0, millisecondsBetween(period.startAt, observedAt))
	);
	return priceUsage(
		terms,
		intendedQuantities(
			{
				cpu: allocationUnits(period.cpu, 'CPU'),
				memoryGiB: allocationUnits(period.mem, 'memory'),
				diskGiB: allocationUnits(period.disk, 'disk'),
				gpu: allocationUnits(period.gpu, 'GPU'),
			},
			period.mode,
			elapsed
		)
	);
}
