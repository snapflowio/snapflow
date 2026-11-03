/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Continent } from '../../../location/enums/continent.enum';
import { MachineState } from '../../../sandbox/machine/enums/machine-state.enum';
import { ListingState } from '../enums/listing-state.enum';
import {
	type MachineBrowseQuery,
	visibleListingCondition,
} from './machine-browse.query';

export interface MachineLocationRow {
	continent: Continent;
	country: string;
	machine_count: number;
}

export function machineLocationQuery(
	customerOrganizationId: string
): MachineBrowseQuery {
	const visible = visibleListingCondition(customerOrganizationId);
	return {
		sql: `SELECT machine.continent, machine.country, count(*)::int AS machine_count
			FROM machine
			JOIN machine_listing listing ON listing."machineId" = machine.id
			JOIN organization ON organization.id = machine."organizationId"
			LEFT JOIN machine_price_card card ON card.id = listing."currentPriceCardId"
			WHERE listing.state = ?
				AND machine.state <> ?
				AND organization."deletedAt" IS NULL
				AND machine.country IS NOT NULL
				AND machine.continent IS NOT NULL
				AND ${visible.sql}
			GROUP BY machine.continent, machine.country
			ORDER BY machine.continent, machine.country`,
		bindings: [
			ListingState.LISTED,
			MachineState.DECOMMISSIONED,
			...visible.bindings,
		],
	};
}
