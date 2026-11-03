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
import { MicroUsd } from '../../../common/values/micro-usd.value';
import { PlacementLocality } from '../../instance/enums/placement-locality.enum';
import {
	type RankablePlacement,
	rankPlacements,
} from './placement-ranking.util';

function placement(
	machineId: string,
	overrides: Partial<RankablePlacement> = {}
): RankablePlacement {
	return {
		machineId,
		gpuTypePriority: 0,
		locationPreference: 0,
		proximityBand: 0,
		hourlyGrossMicroUsd: MicroUsd.of(1_000n),
		egressGrossMicroUsdPerGiB: MicroUsd.of(25_000n),
		reliabilityBasisPoints: 10_000,
		locality: PlacementLocality.REMOTE,
		...overrides,
	};
}

function order(candidates: readonly RankablePlacement[], cap?: MicroUsd) {
	return rankPlacements(candidates, { maxHourlyPriceMicroUsd: cap }).map(
		({ machineId }) => machineId
	);
}

describe('rankPlacements', () => {
	it('drops machines above the price cap', () => {
		assert.deepEqual(
			order(
				[
					placement('a', { hourlyGrossMicroUsd: MicroUsd.of(2_001n) }),
					placement('b'),
				],
				MicroUsd.of(2_000n)
			),
			['b']
		);
	});

	it('drops machines above the egress price cap', () => {
		assert.deepEqual(
			rankPlacements(
				[
					placement('a', { egressGrossMicroUsdPerGiB: MicroUsd.of(25_001n) }),
					placement('b'),
					placement('free', { egressGrossMicroUsdPerGiB: MicroUsd.ZERO }),
				],
				{ maxEgressMicroUsdPerGiB: MicroUsd.of(25_000n) }
			).map(({ machineId }) => machineId),
			['b', 'free']
		);
	});

	it('prefers the requested GPU type before price', () => {
		assert.deepEqual(
			order([
				placement('cheap', {
					gpuTypePriority: 1,
					hourlyGrossMicroUsd: MicroUsd.of(1n),
				}),
				placement('preferred', { hourlyGrossMicroUsd: MicroUsd.of(9_000n) }),
			]),
			['preferred', 'cheap']
		);
	});

	it('prefers earlier requested locations before price', () => {
		assert.deepEqual(
			order([
				placement('cheap-second-choice', {
					locationPreference: 1,
					hourlyGrossMicroUsd: MicroUsd.of(1n),
				}),
				placement('first-choice', { hourlyGrossMicroUsd: MicroUsd.of(9_000n) }),
			]),
			['first-choice', 'cheap-second-choice']
		);
	});

	it('prefers nearer machines before price', () => {
		assert.deepEqual(
			order([
				placement('cheap-far', {
					proximityBand: 3,
					hourlyGrossMicroUsd: MicroUsd.of(1n),
				}),
				placement('near', { hourlyGrossMicroUsd: MicroUsd.of(9_000n) }),
			]),
			['near', 'cheap-far']
		);
	});

	it('ranks location preference before proximity', () => {
		assert.deepEqual(
			order([
				placement('near-second-choice', { locationPreference: 1 }),
				placement('far-first-choice', { proximityBand: 5 }),
			]),
			['far-first-choice', 'near-second-choice']
		);
	});

	it('lets price decide among machines in the same proximity band', () => {
		assert.deepEqual(
			order([
				placement('dear', {
					proximityBand: 1,
					hourlyGrossMicroUsd: MicroUsd.of(2_000n),
				}),
				placement('cheap', {
					proximityBand: 1,
					hourlyGrossMicroUsd: MicroUsd.of(1_000n),
				}),
			]),
			['cheap', 'dear']
		);
	});

	it('weighs price by reliability', () => {
		assert.deepEqual(
			order([
				placement('flaky', {
					hourlyGrossMicroUsd: MicroUsd.of(800n),
					reliabilityBasisPoints: 6_000,
				}),
				placement('steady', { hourlyGrossMicroUsd: MicroUsd.of(1_000n) }),
			]),
			['steady', 'flaky']
		);
	});

	it('floors reliability so a free unreliable machine cannot win by default', () => {
		assert.deepEqual(
			order([
				placement('unproven', {
					hourlyGrossMicroUsd: MicroUsd.of(600n),
					reliabilityBasisPoints: 0,
				}),
				placement('proven', { hourlyGrossMicroUsd: MicroUsd.of(1_000n) }),
			]),
			['proven', 'unproven']
		);
	});

	it('breaks price ties by locality and then by machine id, deterministically', () => {
		const candidates = [
			placement('c'),
			placement('b', { locality: PlacementLocality.PRESENT }),
			placement('a'),
			placement('d', { locality: PlacementLocality.PREPARED }),
		];
		assert.deepEqual(order(candidates), ['d', 'b', 'a', 'c']);
		assert.deepEqual(order([...candidates].reverse()), ['d', 'b', 'a', 'c']);
	});
});
