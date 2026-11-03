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
import { MicroUsd } from '../../../../common/values/micro-usd.value';
import {
	computeRunwayReservationMicroUsd,
	minimumAdmissionReservationMicroUsd,
	networkRunwayReservationMicroUsd,
	unusedReservedMicroUsd,
} from './billing-reservation.util';

describe('unused placement reservations', () => {
	it('subtracts live accrual from the matching placement only', () => {
		const unused = unusedReservedMicroUsd(
			[
				{ placementId: 'placement-a', remainingReservedMicroUsd: '100' },
				{ placementId: 'placement-b', remainingReservedMicroUsd: '100' },
			],
			new Map([
				['placement-a', MicroUsd.of(150n)],
				['placement-b', MicroUsd.of(25n)],
			])
		);

		assert.deepEqual(unused, MicroUsd.of(75n));
	});

	it('keeps the complete reservation when a placement has no live period', () => {
		assert.deepEqual(
			unusedReservedMicroUsd(
				[{ placementId: 'placement-a', remainingReservedMicroUsd: '100' }],
				new Map()
			),
			MicroUsd.of(100n)
		);
	});

	it('rejects corrupt negative reservation values', () => {
		assert.throws(
			() =>
				unusedReservedMicroUsd(
					[{ placementId: 'placement-a', remainingReservedMicroUsd: '-1' }],
					new Map()
				),
			/Placement reservation cannot be negative/
		);
	});
});

describe('runway reservations', () => {
	it('rounds the compute runway reservation up', () => {
		assert.deepEqual(
			computeRunwayReservationMicroUsd(MicroUsd.of(100n), 1n),
			MicroUsd.of(2n)
		);
		assert.deepEqual(
			computeRunwayReservationMicroUsd(MicroUsd.of(60n), 60n),
			MicroUsd.of(60n)
		);
		assert.deepEqual(
			computeRunwayReservationMicroUsd(MicroUsd.ZERO, 60n),
			MicroUsd.ZERO
		);
	});

	it('uses the configured minimum without recent network usage', () => {
		assert.deepEqual(
			networkRunwayReservationMicroUsd({
				recentUsage: { totalMicroUsd: MicroUsd.ZERO, startedAt: null },
				observedAt: new Date('2026-10-02T00:00:00.000Z'),
				runwayMinutes: 60n,
				minimumMicroUsd: MicroUsd.of(5n),
			}),
			MicroUsd.of(5n)
		);
	});

	it('projects the recent network rate over the runway', () => {
		assert.deepEqual(
			networkRunwayReservationMicroUsd({
				recentUsage: {
					totalMicroUsd: MicroUsd.of(2_400n),
					startedAt: new Date('2026-10-01T00:00:00.000Z'),
				},
				observedAt: new Date('2026-10-02T00:00:00.000Z'),
				runwayMinutes: 60n,
				minimumMicroUsd: MicroUsd.of(5n),
			}),
			MicroUsd.of(100n)
		);
	});

	it('requires a positive compute runway on top of the network reservation', () => {
		assert.deepEqual(
			minimumAdmissionReservationMicroUsd(MicroUsd.of(100n), 60n),
			MicroUsd.of(101n)
		);
		assert.deepEqual(
			minimumAdmissionReservationMicroUsd(MicroUsd.ZERO, 120n),
			MicroUsd.of(2n)
		);
	});
});
