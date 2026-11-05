/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import type { GpuType } from '../../sandbox/machine/enums/gpu-type.enum';
import { MARKET_SAMPLE_TIERS } from '../constants/marketplace.constants';
import { ListingState } from '../enums/listing-state.enum';
import { ListingVisibility } from '../enums/listing-visibility.enum';
import type { MachineCategory } from '../enums/machine-category.enum';
import type { PriceCardRates } from '../types/pricing.types';

export interface PricedMachineRow extends PriceCardRates {
	machineId: string;
	organizationId: string;
	category: MachineCategory;
	gpuType: GpuType | null;
	belowFloorSince: Date | string | null;
	aboveEgressCeilingSince: Date | string | null;
}

const PRICED_MACHINE_SQL = `SELECT machine.id AS "machineId", machine."organizationId",
		machine.category, machine."gpuType", listing."belowFloorSince",
		listing."aboveEgressCeilingSince",
		card."vcpuHourMicroUsd"::text AS "vcpuHourMicroUsd",
		card."memoryGibHourMicroUsd"::text AS "memoryGibHourMicroUsd",
		card."gpuHourMicroUsd"::text AS "gpuHourMicroUsd",
		card."diskGibMonthMicroUsd"::text AS "diskGibMonthMicroUsd",
		card."stoppedDiskGibMonthMicroUsd"::text AS "stoppedDiskGibMonthMicroUsd",
		card."egressMicroUsdPerGiB"::text AS "egressMicroUsdPerGiB"
	FROM machine
	JOIN machine_listing listing ON listing."machineId" = machine.id
	JOIN machine_price_card card ON card.id = listing."currentPriceCardId"
	WHERE machine.category IS NOT NULL`;

export function marketSampleMachines(
	manager: EntityManager
): Promise<PricedMachineRow[]> {
	return manager.execute<PricedMachineRow[]>(
		`${PRICED_MACHINE_SQL}
			AND listing.state = ? AND listing.visibility = ?
			AND machine.tier = ANY(ARRAY[?]::varchar[])
			AND machine."restrictedAt" IS NULL`,
		[ListingState.LISTED, ListingVisibility.PUBLIC, MARKET_SAMPLE_TIERS]
	);
}

export function pricedMachinesForUpdate(
	manager: EntityManager
): Promise<PricedMachineRow[]> {
	return manager.execute<PricedMachineRow[]>(
		`${PRICED_MACHINE_SQL}
			ORDER BY machine.id
			FOR UPDATE OF listing`
	);
}
