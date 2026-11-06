/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MILLISECONDS_PER_DAY } from '../../common/constants/time.constants';
import { millisecondsBetween } from '../../common/utils/time.util';
import type { MicroUsd } from '../../common/values/micro-usd.value';
import { utcBillingMonth } from './billing-period.util';

const FIRST_DAY = 1n;

export function utcDayStart(at: Date): Date {
	return new Date(
		Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate())
	);
}

function wholeDays(start: Date, end: Date): bigint {
	return BigInt(
		Math.floor(millisecondsBetween(start, end) / MILLISECONDS_PER_DAY)
	);
}

// A machine in the private pool on any part of a UTC day pays that day's
// share of the monthly fee. Day d of an n-day month costs
// floor(fee * d / n) - floor(fee * (d - 1) / n), so the days of a whole month
// add up to exactly the monthly fee whatever the month's length.
export function privatePoolDayFee(
	monthlyFeeMicroUsd: MicroUsd,
	day: Date
): MicroUsd {
	const month = utcBillingMonth(day);
	const daysInMonth = wholeDays(month.start, month.end);
	const dayOfMonth = wholeDays(month.start, day) + FIRST_DAY;
	const feeThrough = (days: bigint) =>
		monthlyFeeMicroUsd.multiply(days).divideFloor(daysInMonth);
	return feeThrough(dayOfMonth).subtract(feeThrough(dayOfMonth - FIRST_DAY));
}
