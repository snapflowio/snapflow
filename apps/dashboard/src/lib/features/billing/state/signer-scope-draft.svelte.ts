/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { SignerScope as SuggestedScope } from '@snapflow/api-client';
import { MAX_FEE_BPS } from '@snapflow/contracts';
import type { SignerScope } from '@snapflow/sdk';
import { type Address, getAddress } from 'viem';
import { formatMicroUsdAmount, usdInputToMicroUsd } from '#lib/utils/usd.ts';

const SECONDS_PER_DAY = 86_400;
const MINIMUM_DAYS = 1;
const MAXIMUM_DAYS = 365;
const DAYS_PATTERN = /^\d+$/;

const INVALID_HOURLY_CAP =
	'Enter the spending limit as a dollar amount per hour, like 2.50.';
const INVALID_DAYS = `Enter a whole number of days from ${MINIMUM_DAYS} to ${MAXIMUM_DAYS}.`;

function validDays(value: string): number | null {
	if (!DAYS_PATTERN.test(value.trim())) return null;
	const days = Number(value);
	return days >= MINIMUM_DAYS && days <= MAXIMUM_DAYS ? days : null;
}

function suggestedDays(expiry: string, chainNow: string): number {
	const remaining = Number(expiry) - Number(chainNow);
	return Math.min(
		MAXIMUM_DAYS,
		Math.max(MINIMUM_DAYS, Math.ceil(remaining / SECONDS_PER_DAY))
	);
}

export class SignerScopeDraft {
	readonly #suggested: () => SuggestedScope;
	readonly #chainNow: () => string;
	hourlyCap = $state('');
	days = $state('');

	constructor(suggested: () => SuggestedScope, chainNow: () => string) {
		this.#suggested = suggested;
		this.#chainNow = chainNow;
		this.reset();
	}

	get maxFeeBps(): number {
		return Math.min(this.#suggested().maxFeeBps, MAX_FEE_BPS);
	}

	get host(): Address {
		return getAddress(this.#suggested().host);
	}

	readonly error = $derived.by(() => {
		if (usdInputToMicroUsd(this.hourlyCap) === null) return INVALID_HOURLY_CAP;
		return validDays(this.days) === null ? INVALID_DAYS : null;
	});

	reset = (): void => {
		const suggested = this.#suggested();
		this.hourlyCap = formatMicroUsdAmount(suggested.hourlyCap);
		this.days = String(suggestedDays(suggested.expiry, this.#chainNow()));
	};

	scope(): SignerScope | null {
		const hourlyCap = usdInputToMicroUsd(this.hourlyCap);
		const days = validDays(this.days);
		if (this.error !== null || hourlyCap === null || days === null) {
			return null;
		}
		return {
			hourlyCap: BigInt(hourlyCap),
			expiry: BigInt(this.#chainNow()) + BigInt(days * SECONDS_PER_DAY),
			maxFeeBps: this.maxFeeBps,
			host: this.host,
		};
	}
}
