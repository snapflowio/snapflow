/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createHash, randomUUID } from 'node:crypto';
import { BasisPoints } from '../../common/values/basis-points.value';
import type { MicroUsd } from '../../common/values/micro-usd.value';
import { PLACEMENT_LOCALITY_ORDER } from '../../machine/constants/machine-placement.constants';
import {
	MINIMUM_RELIABILITY_FOR_RANKING,
	PLACEMENT_RANKING,
} from '../../marketplace/constants/pricing.constants';
import type { PlacementLocality } from '../../sandbox/enums/placement-locality.enum';

export interface RankablePlacement {
	machineId: string;
	gpuTypePriority: number;
	locationPreference: number;
	proximityBand: number;
	hourlyGrossMicroUsd: MicroUsd;
	reliabilityBasisPoints: number;
	loadBasisPoints: number;
	locality: PlacementLocality;
}

interface RankingKey {
	priceBand: number;
	effectiveMicroUsd: bigint;
	tieBreak: string;
}

const BASIS_POINTS_SCALE = 10_000n;

export function placementReliabilityBasisPoints(
	successMass: number,
	failureMass: number
): number {
	const success = Math.max(0, successMass);
	const failure = Math.max(0, failureMass);
	return Math.floor(
		(Number(BASIS_POINTS_SCALE) *
			(success + PLACEMENT_RANKING.PRIOR_SUCCESS_MASS)) /
			(success + failure + PLACEMENT_RANKING.PRIOR_WEIGHT)
	);
}

function rankingReliability(reliabilityBasisPoints: number): bigint {
	return BasisPoints.of(Math.trunc(reliabilityBasisPoints))
		.max(MINIMUM_RELIABILITY_FOR_RANKING)
		.toBigInt();
}

function rankingKey(placement: RankablePlacement, salt: string): RankingKey {
	const effectiveMicroUsd =
		(placement.hourlyGrossMicroUsd.toBigInt() * BASIS_POINTS_SCALE) /
		rankingReliability(placement.reliabilityBasisPoints);
	return {
		priceBand:
			effectiveMicroUsd > 0n
				? Math.floor(
						Math.log(Number(effectiveMicroUsd)) /
							Math.log(PLACEMENT_RANKING.PRICE_BAND_RATIO)
					)
				: 0,
		effectiveMicroUsd,
		tieBreak: createHash('sha256')
			.update(salt)
			.update(placement.machineId)
			.digest('hex'),
	};
}

function compareBigInts(left: bigint, right: bigint): number {
	if (left < right) return -1;
	return left > right ? 1 : 0;
}

function compareStrings(left: string, right: string): number {
	if (left < right) return -1;
	return left > right ? 1 : 0;
}

function comparePlacements(
	left: RankablePlacement,
	right: RankablePlacement,
	keys: ReadonlyMap<RankablePlacement, RankingKey>
): number {
	const leftKey = keys.get(left);
	const rightKey = keys.get(right);
	if (!leftKey || !rightKey) {
		throw new Error('Every placement needs a ranking key');
	}
	return (
		left.gpuTypePriority - right.gpuTypePriority ||
		left.locationPreference - right.locationPreference ||
		left.proximityBand - right.proximityBand ||
		leftKey.priceBand - rightKey.priceBand ||
		left.loadBasisPoints - right.loadBasisPoints ||
		compareBigInts(leftKey.effectiveMicroUsd, rightKey.effectiveMicroUsd) ||
		PLACEMENT_LOCALITY_ORDER.indexOf(left.locality) -
			PLACEMENT_LOCALITY_ORDER.indexOf(right.locality) ||
		compareStrings(leftKey.tieBreak, rightKey.tieBreak)
	);
}

interface PlacementPriceLimits {
	maxHourlyPriceMicroUsd?: MicroUsd;
}

export function rankPlacements<Candidate extends RankablePlacement>(
	candidates: readonly Candidate[],
	limits: PlacementPriceLimits = {}
): Candidate[] {
	const { maxHourlyPriceMicroUsd } = limits;
	const affordable = candidates.filter(
		({ hourlyGrossMicroUsd }) =>
			maxHourlyPriceMicroUsd === undefined ||
			hourlyGrossMicroUsd.atMost(maxHourlyPriceMicroUsd)
	);
	const salt = randomUUID();
	const keys = new Map<RankablePlacement, RankingKey>(
		affordable.map((placement) => [placement, rankingKey(placement, salt)])
	);
	return affordable.sort((left, right) => comparePlacements(left, right, keys));
}
