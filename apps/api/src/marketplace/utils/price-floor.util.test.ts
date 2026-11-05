/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { MachineCategory } from '../enums/machine-category.enum';
import { PriceFloorSource } from '../enums/price-floor-source.enum';
import {
	effectiveFloor,
	marketMedians,
	nextBelowFloorSince,
	type ReferenceMedians,
	type ReferenceSample,
} from './price-floor.util';

const GENERAL = MachineCategory.GENERAL;
const HIGH_MEMORY = MachineCategory.HIGH_MEMORY;
const POLICY = { floorBasisPoints: 2_500, minimumSamples: 3 };
const EARLIER = new Date('2026-10-01T00:00:00Z');
const NOW = new Date('2026-10-14T00:00:00Z');

function sample(
	priceClass: string,
	organizationId: string,
	referencePriceMicroUsd: bigint
): ReferenceSample {
	return {
		priceClass,
		organizationId,
		referencePriceMicroUsd: MicroUsd.of(referencePriceMicroUsd),
	};
}

function reference(changes: Partial<ReferenceMedians>): ReferenceMedians {
	return {
		priceClass: GENERAL,
		bootstrapMedianMicroUsd: null,
		marketMedianMicroUsd: null,
		sampleCount: 0,
		...changes,
	};
}

describe('market medians', () => {
	it('takes the median per host before the median across hosts', () => {
		const medians = marketMedians([
			sample(GENERAL, 'host-a', 100n),
			sample(GENERAL, 'host-a', 100n),
			sample(GENERAL, 'host-a', 100n),
			sample(GENERAL, 'host-a', 10_000n),
			sample(GENERAL, 'host-b', 300n),
			sample(GENERAL, 'host-c', 500n),
		]);

		assert.deepEqual(medians.get(GENERAL), {
			medianMicroUsd: MicroUsd.of(300n),
			sampleCount: 3,
		});
	});

	it('keeps price classes apart and floors an even median', () => {
		const medians = marketMedians([
			sample(GENERAL, 'host-a', 100n),
			sample(HIGH_MEMORY, 'host-a', 201n),
			sample(HIGH_MEMORY, 'host-b', 400n),
		]);

		assert.deepEqual(medians.get(GENERAL), {
			medianMicroUsd: MicroUsd.of(100n),
			sampleCount: 1,
		});
		assert.deepEqual(medians.get(HIGH_MEMORY), {
			medianMicroUsd: MicroUsd.of(300n),
			sampleCount: 2,
		});
	});
});

describe('effective floor', () => {
	it('uses the market median once enough hosts publish', () => {
		const floor = effectiveFloor(
			reference({
				bootstrapMedianMicroUsd: '1000',
				marketMedianMicroUsd: '2001',
				sampleCount: 3,
			}),
			POLICY
		);

		assert.deepEqual(floor, {
			priceClass: GENERAL,
			medianMicroUsd: MicroUsd.of(2_001n),
			floorMicroUsd: MicroUsd.of(501n),
			sampleCount: 3,
			source: PriceFloorSource.MARKET,
		});
	});

	it('falls to the bootstrap median below the minimum sample count', () => {
		const floor = effectiveFloor(
			reference({
				bootstrapMedianMicroUsd: '1000',
				marketMedianMicroUsd: '2000',
				sampleCount: 2,
			}),
			POLICY
		);

		assert.equal(floor?.source, PriceFloorSource.BOOTSTRAP);
		assert.deepEqual(floor?.medianMicroUsd, MicroUsd.of(1_000n));
		assert.deepEqual(floor?.floorMicroUsd, MicroUsd.of(250n));
	});

	it('has no floor without any median', () => {
		assert.equal(effectiveFloor(reference({ sampleCount: 9 }), POLICY), null);
	});
});

describe('below-floor flag', () => {
	const floor = effectiveFloor(
		reference({ bootstrapMedianMicroUsd: '1000' }),
		POLICY
	);

	it('flags a listing that falls below a later floor and keeps the first date', () => {
		assert.equal(nextBelowFloorSince(MicroUsd.of(249n), floor, null, NOW), NOW);
		assert.equal(
			nextBelowFloorSince(MicroUsd.of(249n), floor, EARLIER, NOW),
			EARLIER
		);
	});

	it('clears the flag at or above the floor and without a floor', () => {
		assert.equal(
			nextBelowFloorSince(MicroUsd.of(250n), floor, EARLIER, NOW),
			null
		);
		assert.equal(
			nextBelowFloorSince(MicroUsd.of(1n), null, EARLIER, NOW),
			null
		);
	});
});
