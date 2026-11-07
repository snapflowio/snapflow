/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import type { GpuType } from '../../machine/enums/gpu-type.enum';
import { MachineState } from '../../machine/enums/machine-state.enum';
import {
	PRICE_HINT_PERCENTILES,
	PRICED_RESOURCE_RATES,
} from '../constants/pricing.constants';
import { ListingState } from '../enums/listing-state.enum';
import { ListingVisibility } from '../enums/listing-visibility.enum';
import type { MachineCategory } from '../enums/machine-category.enum';
import { MachineTier } from '../enums/machine-tier.enum';
import type { PricedResource } from '../enums/priced-resource.enum';

const RANGE_BOUNDS = {
	low: PRICE_HINT_PERCENTILES.LOW,
	high: PRICE_HINT_PERCENTILES.HIGH,
} as const;

type RangeBound = keyof typeof RANGE_BOUNDS;

export type SimilarListingPrices = { listings: number } & Record<
	`${PricedResource}_${RangeBound}`,
	string | null
>;

export interface PriceClassMachine {
	id: string;
	category: MachineCategory;
	gpuType: GpuType | null;
}

const RANGE_SQL = Object.entries(PRICED_RESOURCE_RATES).flatMap(
	([resource, rate]) =>
		Object.entries(RANGE_BOUNDS).map(
			([bound, percentile]) =>
				`percentile_disc(${percentile}) WITHIN GROUP (ORDER BY card."${rate}")::text AS "${resource}_${bound}"`
		)
);

// Current price-card rates of the public listings customers can rent in the
// machine's price class (same category and GPU model), other than the
// machine's own, read live so a hint follows the market as it moves.
export async function similarListingPrices(
	manager: EntityManager,
	machine: PriceClassMachine
): Promise<SimilarListingPrices> {
	const [row] = await manager.execute<SimilarListingPrices[]>(
		`SELECT count(*)::int AS listings, ${RANGE_SQL.join(', ')}
		 FROM machine
		 JOIN machine_listing listing ON listing."machineId" = machine.id
		 JOIN machine_price_card card ON card.id = listing."currentPriceCardId"
		 WHERE listing.state = ? AND listing.visibility = ?
		   AND machine.tier <> ? AND machine."restrictedAt" IS NULL
		   AND machine.state <> ?
		   AND machine.category = ? AND machine."gpuType" IS NOT DISTINCT FROM ?
		   AND machine.id <> ?`,
		[
			ListingState.LISTED,
			ListingVisibility.PUBLIC,
			MachineTier.PRIVATE,
			MachineState.DECOMMISSIONED,
			machine.category,
			machine.gpuType,
			machine.id,
		]
	);
	if (!row) throw new Error('The similar listing aggregate returned no row');
	return row;
}
