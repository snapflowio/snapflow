/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { DISPLAY_LOCALE, formatBasisPointsPercent } from './format.ts';

export const DECIMAL_BASE = 10n;
export const MICRO_USD_DECIMALS = 6;
export const MICRO_USD_PER_USD = DECIMAL_BASE ** BigInt(MICRO_USD_DECIMALS);
const CENT_DECIMALS = 2;
const CENTS_PER_USD = DECIMAL_BASE ** BigInt(CENT_DECIMALS);
export const MICRO_USD_PER_CENT = MICRO_USD_PER_USD / CENTS_PER_USD;
const HALF_CENT_MICRO_USD = MICRO_USD_PER_CENT / 2n;

const USD_INPUT_PATTERN = new RegExp(
	String.raw`^(\d+)(?:\.(\d{1,${MICRO_USD_DECIMALS}}))?$`
);
const CENTS_INPUT_PATTERN = new RegExp(
	String.raw`^(\d+)(?:\.(\d{1,${CENT_DECIMALS}}))?$`
);
const TRAILING_ZEROS = /0+$/;

const USD_CURRENCY = 'USD';
const WHOLE_USD_FORMAT = new Intl.NumberFormat(DISPLAY_LOCALE, {
	currency: USD_CURRENCY,
	maximumFractionDigits: 0,
	minimumFractionDigits: 0,
	style: 'currency',
});
const USD_FORMAT = new Intl.NumberFormat(DISPLAY_LOCALE, {
	currency: USD_CURRENCY,
	style: 'currency',
});

function parseUsd(
	value: string,
	pattern: RegExp,
	decimals: number,
	unitsPerUsd: bigint
): bigint | null {
	const match = pattern.exec(value.trim());
	if (!match?.[1]) return null;
	const fraction = (match[2] ?? '').padEnd(decimals, '0');
	return BigInt(match[1]) * unitsPerUsd + BigInt(fraction);
}

export function usdInputToMicroUsd(value: string): string | null {
	const microUsd = usdInputToNonNegativeMicroUsd(value);
	return microUsd !== null && BigInt(microUsd) > 0n ? microUsd : null;
}

export function usdInputToNonNegativeMicroUsd(value: string): string | null {
	const microUsd = parseUsd(
		value,
		USD_INPUT_PATTERN,
		MICRO_USD_DECIMALS,
		MICRO_USD_PER_USD
	);
	return microUsd === null ? null : microUsd.toString();
}

export function usdInputToCents(value: string): number | null {
	const cents = parseUsd(
		value,
		CENTS_INPUT_PATTERN,
		CENT_DECIMALS,
		CENTS_PER_USD
	);
	if (cents === null || cents <= 0n || cents > BigInt(Number.MAX_SAFE_INTEGER))
		return null;
	return Number(cents);
}

export function centsToMicroUsd(cents: number): string {
	return (BigInt(cents) * MICRO_USD_PER_CENT).toString();
}

export function centsToUsdInput(cents: number): string {
	const amount = BigInt(cents);
	const fraction = (amount % CENTS_PER_USD)
		.toString()
		.padStart(CENT_DECIMALS, '0');
	return `${amount / CENTS_PER_USD}.${fraction}`;
}

function formatUnsignedMicroUsd(amount: bigint): string {
	const whole = amount / MICRO_USD_PER_USD;
	const fraction = (amount % MICRO_USD_PER_USD)
		.toString()
		.padStart(MICRO_USD_DECIMALS, '0')
		.replace(TRAILING_ZEROS, '')
		.padEnd(CENT_DECIMALS, '0');
	return `${whole}.${fraction}`;
}

export function formatMicroUsdAmount(value: string): string {
	const amount = BigInt(value);
	const sign = amount < 0n ? '-' : '';
	return `${sign}${formatUnsignedMicroUsd(amount < 0n ? -amount : amount)}`;
}

export function formatMicroUsd(value: string): string {
	const amount = BigInt(value);
	const sign = amount < 0n ? '-' : '';
	return `${sign}$${formatUnsignedMicroUsd(amount < 0n ? -amount : amount)}`;
}

export function formatUsd(value: string): string {
	const amount = BigInt(value);
	const magnitude = amount < 0n ? -amount : amount;
	if (magnitude < MICRO_USD_PER_CENT) return formatMicroUsd(value);
	const cents = (magnitude + HALF_CENT_MICRO_USD) / MICRO_USD_PER_CENT;
	const rounded = cents * MICRO_USD_PER_CENT;
	return formatMicroUsd((amount < 0n ? -rounded : rounded).toString());
}

export function formatCents(cents: number): string {
	return formatMicroUsd(centsToMicroUsd(cents));
}

export function formatCentsShort(cents: number): string {
	const dollars = cents / Number(CENTS_PER_USD);
	return Number.isInteger(dollars)
		? WHOLE_USD_FORMAT.format(dollars)
		: USD_FORMAT.format(dollars);
}

export function formatHourlyPrice(microUsd: string): string {
	return `${formatMicroUsd(microUsd)}/h`;
}

export function platformFeeLabel(markupBasisPoints: number): string {
	return `Includes ${formatBasisPointsPercent(markupBasisPoints)} platform fee`;
}
