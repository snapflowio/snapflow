/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { USAGE_MONEY_SCALE } from '../../usage/metering/constants/usage-accounting.constants';

const FIXED_POINT_PATTERN = /^(\d+)(?:\.(\d+))?$/;
const DECIMAL_RADIX = 10n;
const FRACTION_PAD = '0';

export function floorDivide(numerator: bigint, denominator: bigint): bigint {
	if (denominator <= 0n) throw new Error('Divisor must be positive');
	const quotient = numerator / denominator;
	return numerator % denominator < 0n ? quotient - 1n : quotient;
}

export function ceilDivide(numerator: bigint, denominator: bigint): bigint {
	return -floorDivide(-numerator, denominator);
}

export function parseFixed(value: string, scale: number, name: string): bigint {
	const match = FIXED_POINT_PATTERN.exec(value);
	if (!match) throw new Error(`${name} must be a nonnegative decimal`);
	const fraction = match[2] ?? '';
	if (fraction.length > scale) {
		throw new Error(`${name} exceeds the supported precision`);
	}
	return (
		BigInt(match[1]) * decimalScale(scale) +
		BigInt(fraction.padEnd(scale, FRACTION_PAD) || FRACTION_PAD)
	);
}

export function decimalScale(decimalPlaces: number): bigint {
	return DECIMAL_RADIX ** BigInt(decimalPlaces);
}

export function fixed(value: bigint, scale: number): string {
	const factor = decimalScale(scale);
	const whole = value / factor;
	const fraction = (value % factor).toString().padStart(scale, FRACTION_PAD);
	return scale === 0 ? whole.toString() : `${whole}.${fraction}`;
}

export function moneyToScaledInteger(value: string): bigint {
	return parseFixed(value, USAGE_MONEY_SCALE, 'money amount');
}
