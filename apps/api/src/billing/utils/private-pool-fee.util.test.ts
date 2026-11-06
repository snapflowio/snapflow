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
import { MILLISECONDS_PER_DAY } from '../../common/constants/time.constants';
import { addDays } from '../../common/utils/time.util';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { privatePoolDayFee, utcDayStart } from './private-pool-fee.util';

const MONTHLY_FEE = MicroUsd.of(5_000_000n);

function monthTotal(firstDay: Date, days: number): MicroUsd {
	return MicroUsd.sum(
		Array.from({ length: days }, (_, index) =>
			privatePoolDayFee(MONTHLY_FEE, addDays(firstDay, index))
		)
	);
}

describe('privatePoolDayFee', () => {
	it('adds up to exactly the monthly fee over a whole month of any length', () => {
		for (const [first, days] of [
			['2026-11-01', 30],
			['2026-12-01', 31],
			['2027-02-01', 28],
			['2028-02-01', 29],
		] as const) {
			assert.deepEqual(
				monthTotal(new Date(`${first}T00:00:00.000Z`), days),
				MONTHLY_FEE,
				first
			);
		}
	});

	it('charges each day an equal share, give or take a micro-dollar', () => {
		const first = new Date('2026-11-01T00:00:00.000Z');
		const fees = Array.from({ length: 30 }, (_, index) =>
			privatePoolDayFee(MONTHLY_FEE, addDays(first, index)).toBigInt()
		);
		assert.deepEqual([...new Set(fees)].sort(), [166_666n, 166_667n]);
	});

	it('charges nothing when the fee is zero', () => {
		assert.equal(
			privatePoolDayFee(
				MicroUsd.ZERO,
				new Date('2026-11-05T00:00:00.000Z')
			).isZero(),
			true
		);
	});
});

describe('utcDayStart', () => {
	it('truncates to the start of the UTC day', () => {
		const day = utcDayStart(new Date('2026-11-05T23:59:59.999Z'));
		assert.equal(day.toISOString(), '2026-11-05T00:00:00.000Z');
		assert.equal(day.getTime() % MILLISECONDS_PER_DAY, 0);
	});
});
