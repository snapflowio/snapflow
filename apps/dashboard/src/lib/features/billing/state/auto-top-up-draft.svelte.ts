/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { AutoTopUp, UpdateAutoTopUp } from '@snapflow/api-client';
import { MIN_AUTO_TOP_UP_INTERVAL } from '@snapflow/contracts';
import {
	formatMicroUsdAmount,
	formatUsd,
	usdcInputUnits,
} from '#lib/utils/usd.ts';

const SECONDS_PER_DAY = 86_400;
const TIMES_PATTERN = /^\d+$/;
export const MINIMUM_TIMES_PER_DAY = 1;
export const MAXIMUM_TIMES_PER_DAY = Math.floor(
	SECONDS_PER_DAY / MIN_AUTO_TOP_UP_INTERVAL
);

const INVALID_AMOUNT = 'Enter the top-up amount as a dollar amount, like 50.';
const INVALID_THRESHOLD = 'Enter the balance as a dollar amount, like 20.';
const INVALID_TIMES = `Enter a whole number of top-ups a day from ${MINIMUM_TIMES_PER_DAY} to ${MAXIMUM_TIMES_PER_DAY}.`;
const INVALID_ALLOWANCE = 'Enter the allowance as a dollar amount, like 500.';
const ALLOWANCE_BELOW_AMOUNT = 'The allowance cannot be below one top-up.';

function belowMinimumMessage(minimum: bigint): string {
	return `Each top-up must be at least ${formatUsd(minimum.toString())}.`;
}

function notAboveFeeMessage(maxRelayFee: string): string {
	return `Each top-up must be above the ${formatUsd(maxRelayFee)} relay fee.`;
}

function validTimes(value: string): number | null {
	if (!TIMES_PATTERN.test(value.trim())) return null;
	const times = Number(value);
	return times >= MINIMUM_TIMES_PER_DAY && times <= MAXIMUM_TIMES_PER_DAY
		? times
		: null;
}

export class AutoTopUpDraft {
	readonly #current: () => AutoTopUp;
	readonly #minimumOf: () => bigint | null;
	amount = $state('');
	threshold = $state('');
	timesPerDay = $state('');
	allowance = $state('');

	readonly error = $derived.by(() => {
		const amount = usdcInputUnits(this.amount);
		if (amount === null) return INVALID_AMOUNT;
		const minimum = this.#minimumOf();
		if (minimum !== null && amount < minimum) {
			return belowMinimumMessage(minimum);
		}
		const { maxRelayFee } = this.#current();
		if (amount <= BigInt(maxRelayFee)) return notAboveFeeMessage(maxRelayFee);
		if (usdcInputUnits(this.threshold) === null) return INVALID_THRESHOLD;
		if (validTimes(this.timesPerDay) === null) return INVALID_TIMES;
		const allowance = usdcInputUnits(this.allowance);
		if (allowance === null) return INVALID_ALLOWANCE;
		return allowance < amount ? ALLOWANCE_BELOW_AMOUNT : null;
	});

	constructor(current: () => AutoTopUp, minimum: () => bigint | null) {
		this.#current = current;
		this.#minimumOf = minimum;
		this.reset();
	}

	get maxRelayFee(): string {
		return this.#current().maxRelayFee;
	}

	reset = (): void => {
		const current = this.#current();
		this.amount = formatMicroUsdAmount(current.amount);
		this.threshold = formatMicroUsdAmount(current.threshold);
		this.timesPerDay = String(current.timesPerDay);
		this.allowance = formatMicroUsdAmount(
			(BigInt(current.amount) * BigInt(current.timesPerDay)).toString()
		);
	};

	settings(): UpdateAutoTopUp | null {
		const amount = usdcInputUnits(this.amount);
		const threshold = usdcInputUnits(this.threshold);
		const timesPerDay = validTimes(this.timesPerDay);
		if (
			this.error !== null ||
			amount === null ||
			threshold === null ||
			timesPerDay === null
		) {
			return null;
		}
		return {
			enabled: true,
			amount: amount.toString(),
			threshold: threshold.toString(),
			maxRelayFee: this.maxRelayFee,
			timesPerDay,
		};
	}

	allowanceUnits(): bigint | null {
		return this.error === null ? usdcInputUnits(this.allowance) : null;
	}
}
