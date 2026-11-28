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
const SUB_DOLLAR_RATE_DECIMALS = 4;

const USD_INPUT_PATTERN = new RegExp(
	String.raw`^(\d+)(?:\.(\d{1,${MICRO_USD_DECIMALS}}))?$`
);
const TRAILING_ZEROS = /0+$/;
const WHOLE_FORMAT = new Intl.NumberFormat(DISPLAY_LOCALE, {
	maximumFractionDigits: 0,
});

export interface MicroUsdParts {
	negative: boolean;
	whole: string;
	fraction: string;
}

export function usdInputToMicroUsd(value: string): string | null {
	const microUsd = usdInputToNonNegativeMicroUsd(value);
	return microUsd !== null && BigInt(microUsd) > 0n ? microUsd : null;
}

export function usdInputToNonNegativeMicroUsd(value: string): string | null {
	const match = USD_INPUT_PATTERN.exec(value.trim());
	if (!match?.[1]) return null;
	const fraction = (match[2] ?? '').padEnd(MICRO_USD_DECIMALS, '0');
	return (BigInt(match[1]) * MICRO_USD_PER_USD + BigInt(fraction)).toString();
}

function unsignedFraction(amount: bigint): string {
	return (amount % MICRO_USD_PER_USD)
		.toString()
		.padStart(MICRO_USD_DECIMALS, '0')
		.replace(TRAILING_ZEROS, '')
		.padEnd(CENT_DECIMALS, '0');
}

function formatUnsignedMicroUsd(amount: bigint, grouped: boolean): string {
	const whole = amount / MICRO_USD_PER_USD;
	const wholeText = grouped ? WHOLE_FORMAT.format(whole) : whole.toString();
	return `${wholeText}.${unsignedFraction(amount)}`;
}

export function roundedToCents(amount: bigint): bigint {
	const magnitude = amount < 0n ? -amount : amount;
	const cents = (magnitude + HALF_CENT_MICRO_USD) / MICRO_USD_PER_CENT;
	const rounded = cents * MICRO_USD_PER_CENT;
	return amount < 0n ? -rounded : rounded;
}

export function microUsdParts(amount: bigint): MicroUsdParts {
	const negative = amount < 0n;
	const magnitude = negative ? -amount : amount;
	return {
		negative,
		whole: WHOLE_FORMAT.format(magnitude / MICRO_USD_PER_USD),
		fraction: unsignedFraction(magnitude),
	};
}

export function isSubCent(amount: bigint): boolean {
	return amount % MICRO_USD_PER_CENT !== 0n;
}

export function formatMicroUsdAmount(value: string): string {
	const amount = BigInt(value);
	const sign = amount < 0n ? '-' : '';
	return `${sign}${formatUnsignedMicroUsd(amount < 0n ? -amount : amount, false)}`;
}

export function formatMicroUsd(value: string): string {
	const amount = BigInt(value);
	const sign = amount < 0n ? '-' : '';
	return `${sign}$${formatUnsignedMicroUsd(amount < 0n ? -amount : amount, true)}`;
}

export function formatUsd(value: string): string {
	const amount = BigInt(value);
	const magnitude = amount < 0n ? -amount : amount;
	if (magnitude < MICRO_USD_PER_CENT) return formatMicroUsd(value);
	return formatMicroUsd(roundedToCents(amount).toString());
}

function roundedMicroUsd(amount: bigint, decimals: number): bigint {
	const step = DECIMAL_BASE ** BigInt(MICRO_USD_DECIMALS - decimals);
	const magnitude = amount < 0n ? -amount : amount;
	const rounded = ((magnitude + step / 2n) / step) * step;
	return amount < 0n ? -rounded : rounded;
}

export function formatRate(microUsd: string): string {
	const amount = BigInt(microUsd);
	const magnitude = amount < 0n ? -amount : amount;
	const decimals =
		magnitude < MICRO_USD_PER_USD ? SUB_DOLLAR_RATE_DECIMALS : CENT_DECIMALS;
	const rounded = roundedMicroUsd(amount, decimals);
	return formatMicroUsd((rounded === 0n ? amount : rounded).toString());
}

export function formatHourlyPrice(microUsd: string): string {
	return `${formatRate(microUsd)}/h`;
}

export function platformFeeLabel(markupBasisPoints: number): string {
	return `Includes ${formatBasisPointsPercent(markupBasisPoints)} platform fee`;
}

const INVALID_USDC_AMOUNT_MESSAGE = 'Enter a USDC amount, like 50 or 12.50.';

export function usdcInputUnits(value: string): bigint | null {
	const microUsd = usdInputToMicroUsd(value);
	return microUsd === null ? null : BigInt(microUsd);
}

export function usdcAmountError(
	value: string,
	maximum: bigint | undefined,
	aboveMaximumMessage: string
): string | null {
	if (value.trim() === '') return null;
	const units = usdcInputUnits(value);
	if (units === null) return INVALID_USDC_AMOUNT_MESSAGE;
	return maximum !== undefined && units > maximum ? aboveMaximumMessage : null;
}
