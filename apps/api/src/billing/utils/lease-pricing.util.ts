/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ResourceShape } from '../../common/values/resource-shape.value';
import { SELF_USE_MARKUP_BASIS_POINTS } from '../../marketplace/constants/marketplace.constants';
import type { SandboxLease } from '../../marketplace/entities/sandbox-lease.entity';
import type {
	PriceCardRates,
	PriceTerms,
} from '../../marketplace/types/pricing.types';
import { priceTerms } from '../../marketplace/utils/pricing.util';

const UNPRICED_RATE = '0';

const SELF_USE_RATES: PriceCardRates = {
	vcpuHourMicroUsd: UNPRICED_RATE,
	memoryGibHourMicroUsd: UNPRICED_RATE,
	gpuHourMicroUsd: UNPRICED_RATE,
	diskGibMonthMicroUsd: UNPRICED_RATE,
	stoppedDiskGibMonthMicroUsd: UNPRICED_RATE,
	egressMicroUsdPerGiB: UNPRICED_RATE,
};

export function placementPriceTerms(
	card: PriceCardRates | null,
	markupBasisPoints: number
): PriceTerms {
	return card
		? priceTerms(card, markupBasisPoints)
		: priceTerms(SELF_USE_RATES, SELF_USE_MARKUP_BASIS_POINTS);
}

export function leaseShape(
	lease: Pick<SandboxLease, 'cpu' | 'memoryGib' | 'diskGib' | 'gpu'>
): ResourceShape {
	return ResourceShape.fromColumns(lease);
}
