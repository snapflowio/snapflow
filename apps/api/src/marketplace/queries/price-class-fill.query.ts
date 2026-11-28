/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { BASIS_POINTS_SCALE } from '../../common/constants/money.constants';
import { GPU_PRICE_CLASS_PREFIX } from '../constants/marketplace.constants';
import { ListingState } from '../enums/listing-state.enum';
import { ListingVisibility } from '../enums/listing-visibility.enum';
import { MachineCategory } from '../enums/machine-category.enum';
import {
	MACHINE_LOAD_BINDINGS,
	MACHINE_LOAD_SQL,
} from './machine-eligibility.query';

export const PRICE_CLASS_SQL = `CASE WHEN machine.category = ? THEN ? || machine."gpuType" ELSE machine.category END`;

export const PRICE_CLASS_BINDINGS = [
	MachineCategory.GPU,
	GPU_PRICE_CLASS_PREFIX,
] as const;

export interface PriceClassFill {
	fillBasisPoints: number;
	capacityUnits: number;
}

export async function priceClassFillRates(
	manager: EntityManager
): Promise<Map<string, PriceClassFill>> {
	const rows = await manager.execute<
		{
			priceClass: string;
			fillBasisPoints: number | null;
			capacityUnits: number | null;
		}[]
	>(
		`SELECT ${PRICE_CLASS_SQL} AS "priceClass",
			floor(? * sum(CASE WHEN machine.category = ? THEN load.gpu ELSE machine."currentAllocatedCpu" END)
				/ nullif(sum(CASE WHEN machine.category = ? THEN machine."gpuCount" ELSE machine.cpu END), 0))::integer AS "fillBasisPoints",
			sum(CASE WHEN machine.category = ? THEN machine."gpuCount" ELSE machine.cpu END)::float8 AS "capacityUnits"
		 FROM machine
		 JOIN machine_listing listing ON listing."machineId" = machine.id
		 CROSS JOIN LATERAL (${MACHINE_LOAD_SQL}) load
		 WHERE listing.state = ? AND listing.visibility = ? AND machine.category IS NOT NULL
		 GROUP BY 1`,
		[
			...PRICE_CLASS_BINDINGS,
			BASIS_POINTS_SCALE,
			MachineCategory.GPU,
			MachineCategory.GPU,
			MachineCategory.GPU,
			...MACHINE_LOAD_BINDINGS,
			ListingState.LISTED,
			ListingVisibility.PUBLIC,
		]
	);
	return new Map(
		rows.map((row) => [
			row.priceClass,
			{
				fillBasisPoints: row.fillBasisPoints ?? 0,
				capacityUnits: row.capacityUnits ?? 0,
			},
		])
	);
}
