/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import {
	HOST_RATE_FIELDS,
	MARKET_PERCENTILES,
} from '../constants/pricing.constants';
import { ListingState } from '../enums/listing-state.enum';
import { ListingVisibility } from '../enums/listing-visibility.enum';
import {
	PRICE_CLASS_BINDINGS,
	PRICE_CLASS_SQL,
} from './price-class-fill.query';

type HostRateField = (typeof HOST_RATE_FIELDS)[number];

const PERCENTILE_ARRAY = `ARRAY[${Object.values(MARKET_PERCENTILES).join(', ')}]`;

const RATE_PERCENTILES_SQL = HOST_RATE_FIELDS.map(
	(field) =>
		`percentile_disc(${PERCENTILE_ARRAY}) WITHIN GROUP (ORDER BY card."${field}")::text[] AS "${field}"`
).join(',\n\t\t\t');

export async function priceClassRatePercentiles(
	manager: EntityManager,
	priceClass: string,
	excludedMachineId: string
) {
	const [row] = await manager.execute<
		({ listings: number } & Record<HostRateField, string[] | null>)[]
	>(
		`SELECT count(*)::integer AS "listings",
			${RATE_PERCENTILES_SQL}
		 FROM machine
		 JOIN machine_listing listing ON listing."machineId" = machine.id
		 JOIN machine_price_card card ON card.id = listing."currentPriceCardId"
		 WHERE listing.state = ? AND listing.visibility = ? AND machine.id <> ?
			AND ${PRICE_CLASS_SQL} = ?`,
		[
			ListingState.LISTED,
			ListingVisibility.PUBLIC,
			excludedMachineId,
			...PRICE_CLASS_BINDINGS,
			priceClass,
		]
	);
	return row ?? null;
}
