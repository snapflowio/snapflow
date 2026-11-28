/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { formatUsd, MICRO_USD_PER_USD } from '#lib/utils/usd.ts';
import { SECONDS_PER_HOUR } from './escrow-terms.ts';

const SMALL_DEPOSIT_USD = 20n;
const MEDIUM_DEPOSIT_USD = 50n;
const LARGE_DEPOSIT_USD = 100n;
const LARGEST_DEPOSIT_USD = 250n;

export const DEPOSIT_PRESETS_MICRO_USD = [
	SMALL_DEPOSIT_USD * MICRO_USD_PER_USD,
	MEDIUM_DEPOSIT_USD * MICRO_USD_PER_USD,
	LARGE_DEPOSIT_USD * MICRO_USD_PER_USD,
	LARGEST_DEPOSIT_USD * MICRO_USD_PER_USD,
] as const;

const ZERO_AMOUNT_MESSAGE = 'Enter an amount above $0.';

export function belowMinimumMessage(minimum: bigint): string {
	return `The smallest deposit is ${formatUsd(minimum.toString())}.`;
}

export function aboveCapMessage(room: bigint): string {
	return room === 0n
		? 'The escrow deposit cap is reached, so it cannot take more USDC right now.'
		: `The escrow can take ${formatUsd(room.toString())} more.`;
}

export function amountError(
	amount: bigint | null,
	maximum: bigint | undefined | null,
	aboveMaximumMessage: string
): string | null {
	if (amount === null) return null;
	if (amount <= 0n) return ZERO_AMOUNT_MESSAGE;
	return maximum !== undefined && maximum !== null && amount > maximum
		? aboveMaximumMessage
		: null;
}

export function presetDisabledReason(
	preset: bigint,
	minimum: bigint | null,
	room: bigint | null
): string | undefined {
	if (minimum !== null && preset < minimum) return belowMinimumMessage(minimum);
	if (room !== null && preset > room) return aboveCapMessage(room);
	return undefined;
}

export function runwayAfterSeconds(
	availableMicroUsd: bigint,
	burnMicroUsdPerHour: bigint
): bigint | null {
	if (burnMicroUsdPerHour <= 0n) return null;
	const available = availableMicroUsd > 0n ? availableMicroUsd : 0n;
	return (available * SECONDS_PER_HOUR) / burnMicroUsdPerHour;
}
