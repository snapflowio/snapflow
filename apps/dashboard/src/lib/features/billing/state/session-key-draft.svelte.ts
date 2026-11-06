/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { VoucherDelegation } from '@snapflow/api-client';
import { getAddress } from 'viem';
import type { SessionKeyGrant } from '#lib/features/billing/lib/escrow-contract.ts';
import { formatMicroUsdAmount, usdInputToMicroUsd } from '#lib/utils/usd.ts';

const SECONDS_PER_DAY = 86_400;
const MILLISECONDS_PER_SECOND = 1_000;
const MINIMUM_DAYS = 1;
const MAXIMUM_DAYS = 365;
const DAYS_PATTERN = /^\d+$/;

const INVALID_SPEND_CAP = 'Enter the spend cap as a dollar amount, like 100.';
const INVALID_HOURLY_CAP =
	'Enter the hourly cap as a dollar amount, like 2.50.';
const HOURLY_ABOVE_SPEND = 'The hourly cap cannot be above the spend cap.';
const INVALID_DAYS = `Enter a whole number of days from ${MINIMUM_DAYS} to ${MAXIMUM_DAYS}.`;

interface SessionKeyValues {
	spendCap: string;
	hourlyCap: string;
	days: string;
}

function nowSeconds(): number {
	return Math.floor(Date.now() / MILLISECONDS_PER_SECOND);
}

function suggestedValues(delegation: VoucherDelegation): SessionKeyValues {
	const remainingSeconds = Number(delegation.suggestedExpiry) - nowSeconds();
	const days = Math.min(
		MAXIMUM_DAYS,
		Math.max(MINIMUM_DAYS, Math.ceil(remainingSeconds / SECONDS_PER_DAY))
	);
	return {
		spendCap: formatMicroUsdAmount(delegation.suggestedSpendCapMicroUsd),
		hourlyCap: formatMicroUsdAmount(delegation.suggestedHourlyCapMicroUsd),
		days: String(days),
	};
}

function validDays(value: string): number | null {
	if (!DAYS_PATTERN.test(value.trim())) return null;
	const days = Number(value);
	return days >= MINIMUM_DAYS && days <= MAXIMUM_DAYS ? days : null;
}

export class SessionKeyDraft {
	readonly #delegation: () => VoucherDelegation;
	spendCap = $state('');
	hourlyCap = $state('');
	days = $state('');

	constructor(delegation: () => VoucherDelegation) {
		this.#delegation = delegation;
		this.reset();
	}

	readonly error = $derived.by(() => {
		const spendCap = usdInputToMicroUsd(this.spendCap);
		if (spendCap === null) return INVALID_SPEND_CAP;
		const hourlyCap = usdInputToMicroUsd(this.hourlyCap);
		if (hourlyCap === null) return INVALID_HOURLY_CAP;
		if (BigInt(hourlyCap) > BigInt(spendCap)) return HOURLY_ABOVE_SPEND;
		return validDays(this.days) === null ? INVALID_DAYS : null;
	});

	reset = (): void => {
		const values = suggestedValues(this.#delegation());
		this.spendCap = values.spendCap;
		this.hourlyCap = values.hourlyCap;
		this.days = values.days;
	};

	grant(): SessionKeyGrant | null {
		const spendCap = usdInputToMicroUsd(this.spendCap);
		const hourlyCap = usdInputToMicroUsd(this.hourlyCap);
		const days = validDays(this.days);
		if (this.error !== null || !spendCap || !hourlyCap || days === null) {
			return null;
		}
		return {
			key: getAddress(this.#delegation().signerAddress),
			spendCap: BigInt(spendCap),
			hourlyCap: BigInt(hourlyCap),
			expiry: BigInt(nowSeconds() + days * SECONDS_PER_DAY),
		};
	}
}
