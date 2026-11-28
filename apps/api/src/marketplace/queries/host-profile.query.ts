/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MachineState } from '../../machine/enums/machine-state.enum';
import { ListingState } from '../enums/listing-state.enum';
import type { MachineTier } from '../enums/machine-tier.enum';
import {
	HOST_DISPLAY_NAME_SQL,
	type MachineBrowseQuery,
	publicListingCondition,
	visibleListingCondition,
} from './machine-browse.query';

export interface HostProfileRow {
	organization_id: string;
	display_name: string;
	description: string | null;
	host_terms_version: string | null;
}

export interface HostStatsRow {
	listed_machines: number;
	uptime_basis_points: number | null;
	reliability_basis_points: number | null;
	tiers: MachineTier[] | null;
}

const LISTED_MACHINE_JOINS = `FROM machine
	JOIN machine_listing listing ON listing."machineId" = machine.id
	JOIN organization ON organization.id = machine."organizationId"
	LEFT JOIN machine_price_card card ON card.id = listing."currentPriceCardId"`;

export function hostProfileQuery(organizationId: string): MachineBrowseQuery {
	return {
		sql: `SELECT organization.id AS organization_id,
				${HOST_DISPLAY_NAME_SQL} AS display_name,
				host_profile.description,
				host_profile."hostTermsVersion" AS host_terms_version
			FROM organization
			LEFT JOIN host_profile ON host_profile."organizationId" = organization.id
			WHERE organization.id = ? AND organization."deletedAt" IS NULL`,
		bindings: [organizationId],
	};
}

export function hostStatsQuery(organizationId: string): MachineBrowseQuery {
	const publicListing = publicListingCondition();
	return {
		sql: `SELECT count(*)::int AS listed_machines,
				round(avg(assessment."uptimeBasisPoints"))::int AS uptime_basis_points,
				round(avg(assessment."reliabilityBasisPoints"))::int AS reliability_basis_points,
				array_agg(DISTINCT machine.tier) FILTER (WHERE machine.tier IS NOT NULL) AS tiers
			${LISTED_MACHINE_JOINS}
			LEFT JOIN machine_assessment assessment ON assessment."machineId" = machine.id
			WHERE machine."organizationId" = ?
				AND listing.state = ?
				AND machine.state <> ?
				AND ${publicListing.sql}`,
		bindings: [
			organizationId,
			ListingState.LISTED,
			MachineState.DECOMMISSIONED,
			...publicListing.bindings,
		],
	};
}

export function listingHostQuery(
	machineId: string,
	customerOrganizationId: string
): MachineBrowseQuery {
	const visible = visibleListingCondition(customerOrganizationId);
	return {
		sql: `SELECT machine."organizationId" AS organization_id
			${LISTED_MACHINE_JOINS}
			WHERE machine.id = ?
				AND listing.state = ANY(ARRAY[?]::varchar[])
				AND machine.state <> ?
				AND organization."deletedAt" IS NULL
				AND ${visible.sql}`,
		bindings: [
			machineId,
			[ListingState.LISTED, ListingState.PAUSED],
			MachineState.DECOMMISSIONED,
			...visible.bindings,
		],
	};
}
