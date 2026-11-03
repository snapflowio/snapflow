/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BasisPoints } from '../../../common/values/basis-points.value';
import type { MicroUsd } from '../../../common/values/micro-usd.value';
import { MINIMUM_RELIABILITY_FOR_RANKING } from '../../../marketplace/machine/constants/pricing.constants';
import type { PlacementLocality } from '../../instance/enums/placement-locality.enum';
import { PLACEMENT_LOCALITY_ORDER } from '../../machine/constants/machine-placement.constants';

export interface RankablePlacement {
	machineId: string;
	gpuTypePriority: number;
	locationPreference: number;
	proximityBand: number;
	hourlyGrossMicroUsd: MicroUsd;
	egressGrossMicroUsdPerGiB: MicroUsd;
	reliabilityBasisPoints: number;
	locality: PlacementLocality;
}

function rankingReliability(reliabilityBasisPoints: number): bigint {
	return BasisPoints.of(Math.trunc(reliabilityBasisPoints))
		.max(MINIMUM_RELIABILITY_FOR_RANKING)
		.toBigInt();
}

function compareStrings(left: string, right: string): number {
	if (left < right) return -1;
	return left > right ? 1 : 0;
}

export function comparePlacements(
	left: RankablePlacement,
	right: RankablePlacement
): number {
	return (
		left.gpuTypePriority - right.gpuTypePriority ||
		left.locationPreference - right.locationPreference ||
		left.proximityBand - right.proximityBand ||
		left.hourlyGrossMicroUsd
			.multiply(rankingReliability(right.reliabilityBasisPoints))
			.compare(
				right.hourlyGrossMicroUsd.multiply(
					rankingReliability(left.reliabilityBasisPoints)
				)
			) ||
		PLACEMENT_LOCALITY_ORDER.indexOf(left.locality) -
			PLACEMENT_LOCALITY_ORDER.indexOf(right.locality) ||
		compareStrings(left.machineId, right.machineId)
	);
}

export interface PlacementPriceLimits {
	maxHourlyPriceMicroUsd?: MicroUsd;
	maxEgressMicroUsdPerGiB?: MicroUsd;
}

export function rankPlacements<Candidate extends RankablePlacement>(
	candidates: readonly Candidate[],
	limits: PlacementPriceLimits = {}
): Candidate[] {
	const { maxHourlyPriceMicroUsd, maxEgressMicroUsdPerGiB } = limits;
	return candidates
		.filter(
			({ hourlyGrossMicroUsd, egressGrossMicroUsdPerGiB }) =>
				(maxHourlyPriceMicroUsd === undefined ||
					hourlyGrossMicroUsd.atMost(maxHourlyPriceMicroUsd)) &&
				(maxEgressMicroUsdPerGiB === undefined ||
					egressGrossMicroUsdPerGiB.atMost(maxEgressMicroUsdPerGiB))
		)
		.sort(comparePlacements);
}
