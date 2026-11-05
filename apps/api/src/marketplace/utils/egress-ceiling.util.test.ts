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
import { EgressCeilingSource } from '../enums/egress-ceiling-source.enum';
import {
	egressCeiling,
	nextAboveEgressCeilingSince,
} from './egress-ceiling.util';

const POLICY = {
	maximumMicroUsdPerGiB: MicroUsd.of(100_000n),
	medianBasisPoints: 40_000,
	minimumSamples: 5,
};
const NOW = new Date('2026-10-18T12:00:00.000Z');
const EARLIER = new Date('2026-10-17T12:00:00.000Z');

describe('egress ceiling', () => {
	it('uses the settings maximum until the market has enough samples', () => {
		assert.deepEqual(egressCeiling(null, POLICY), {
			ceilingMicroUsdPerGiB: MicroUsd.of(100_000n),
			medianMicroUsdPerGiB: null,
			sampleCount: 0,
			source: EgressCeilingSource.SETTINGS,
		});
		assert.equal(
			egressCeiling({ marketMedianMicroUsd: '10000', sampleCount: 4 }, POLICY)
				.source,
			EgressCeilingSource.SETTINGS
		);
	});

	it('caps at four times the Verified median when that is lower', () => {
		assert.deepEqual(
			egressCeiling({ marketMedianMicroUsd: '10001', sampleCount: 5 }, POLICY),
			{
				ceilingMicroUsdPerGiB: MicroUsd.of(40_004n),
				medianMicroUsdPerGiB: MicroUsd.of(10_001n),
				sampleCount: 5,
				source: EgressCeilingSource.MARKET,
			}
		);
	});

	it('keeps the settings maximum when the market multiple is higher', () => {
		const ceiling = egressCeiling(
			{ marketMedianMicroUsd: '30000', sampleCount: 9 },
			POLICY
		);
		assert.deepEqual(ceiling.ceilingMicroUsdPerGiB, MicroUsd.of(100_000n));
		assert.equal(ceiling.source, EgressCeilingSource.SETTINGS);
	});

	it('ignores a zero median, which carries no price signal', () => {
		const ceiling = egressCeiling(
			{ marketMedianMicroUsd: '0', sampleCount: 9 },
			POLICY
		);
		assert.deepEqual(ceiling.ceilingMicroUsdPerGiB, MicroUsd.of(100_000n));
		assert.equal(ceiling.source, EgressCeilingSource.SETTINGS);
	});

	it('flags a listing above a later ceiling and keeps the first flag time', () => {
		const ceiling = egressCeiling(null, POLICY);
		assert.equal(
			nextAboveEgressCeilingSince(MicroUsd.of(100_000n), ceiling, null, NOW),
			null
		);
		assert.equal(
			nextAboveEgressCeilingSince(MicroUsd.of(100_001n), ceiling, null, NOW),
			NOW
		);
		assert.equal(
			nextAboveEgressCeilingSince(MicroUsd.of(100_001n), ceiling, EARLIER, NOW),
			EARLIER
		);
	});
});
