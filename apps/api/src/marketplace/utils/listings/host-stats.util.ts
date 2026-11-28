/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MACHINE_TIER_ORDER } from '../../constants/marketplace.constants';
import type { HostStatsDto } from '../../dto/host-profile.dto';
import type { MachineTier } from '../../enums/machine-tier.enum';
import type { HostStatsRow } from '../../queries/host-profile.query';

function topTier(tiers: readonly MachineTier[]): MachineTier | null {
	let top: MachineTier | null = null;
	for (const tier of tiers) {
		if (
			top === null ||
			MACHINE_TIER_ORDER.indexOf(tier) > MACHINE_TIER_ORDER.indexOf(top)
		) {
			top = tier;
		}
	}
	return top;
}

export function hostStats(row: HostStatsRow | undefined): HostStatsDto {
	return {
		listedMachines: row?.listed_machines ?? 0,
		uptimeBasisPoints: row?.uptime_basis_points ?? null,
		reliabilityBasisPoints: row?.reliability_basis_points ?? null,
		topTier: topTier(row?.tiers ?? []),
	};
}
