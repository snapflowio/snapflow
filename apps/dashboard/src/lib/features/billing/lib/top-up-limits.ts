/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { BillingConfig } from '@snapflow/api-client';
import { DISPLAY_LOCALE } from '#lib/utils/format.ts';
import {
	formatCents,
	formatCentsShort,
	usdInputToCents,
} from '#lib/utils/usd.ts';

type TopUpLimits = Pick<
	BillingConfig,
	'topUpMaximumCents' | 'topUpMinimumCents' | 'topUpPresetsCents'
>;

export const NO_REFUNDS_NOTICE =
	'Purchased credit is non-refundable. It never expires while your organization exists, but it cannot be paid back to your card.';

export const TOP_UP_PAY_NOTICE =
	'Credit is non-refundable. Sales tax is added where it applies.';

const TYPICAL_TOP_UP_CENTS = 2_500;
const INVALID_AMOUNT_MESSAGE =
	'Enter an amount in USD with at most two decimal places.';
const INVALID_AUTO_TOP_UP_AMOUNTS_MESSAGE =
	'Enter the threshold and amount in USD with at most two decimal places.';
const UNLIMITED_AUTO_TOP_UP_CADENCE = 'as often as needed';
const MINUTES_FORMAT = new Intl.NumberFormat(DISPLAY_LOCALE, {
	style: 'unit',
	unit: 'minute',
	unitDisplay: 'long',
});

function withinTopUpLimits(cents: number, limits: TopUpLimits): boolean {
	return cents >= limits.topUpMinimumCents && cents <= limits.topUpMaximumCents;
}

export function topUpPresets(limits: TopUpLimits): number[] {
	return limits.topUpPresetsCents.filter((cents) =>
		withinTopUpLimits(cents, limits)
	);
}

export function defaultTopUpCents(limits: TopUpLimits): number {
	const presets = topUpPresets(limits);
	const typical = presets.filter((cents) => cents >= TYPICAL_TOP_UP_CENTS);
	if (typical.length > 0) return Math.min(...typical);
	return presets[0] ?? limits.topUpMinimumCents;
}

export function topUpLimitsHint(limits: TopUpLimits): string {
	return `Between ${formatCentsShort(limits.topUpMinimumCents)} and ${formatCentsShort(limits.topUpMaximumCents)}.`;
}

export function topUpAmountError(
	amount: string,
	limits: TopUpLimits
): string | null {
	if (amount.trim() === '') return null;
	const cents = usdInputToCents(amount);
	if (cents === null) return INVALID_AMOUNT_MESSAGE;
	return withinTopUpLimits(cents, limits)
		? null
		: `Top up between ${formatCents(limits.topUpMinimumCents)} and ${formatCents(limits.topUpMaximumCents)}.`;
}

export function autoTopUpAmountsError(
	threshold: string,
	amount: string,
	{ autoTopUpMinimumCents }: Pick<BillingConfig, 'autoTopUpMinimumCents'>
): string | null {
	const thresholdCents = usdInputToCents(threshold);
	const amountCents = usdInputToCents(amount);
	if (
		(threshold.trim() !== '' && thresholdCents === null) ||
		(amount.trim() !== '' && amountCents === null)
	) {
		return INVALID_AUTO_TOP_UP_AMOUNTS_MESSAGE;
	}
	return amountCents !== null && amountCents < autoTopUpMinimumCents
		? `Automatic top-ups must buy at least ${formatCents(autoTopUpMinimumCents)}.`
		: null;
}

export function autoTopUpCadence({
	autoTopUpMinimumIntervalMinutes,
}: Pick<BillingConfig, 'autoTopUpMinimumIntervalMinutes'>): string {
	return autoTopUpMinimumIntervalMinutes > 0
		? `at most once every ${MINUTES_FORMAT.format(autoTopUpMinimumIntervalMinutes)}`
		: UNLIMITED_AUTO_TOP_UP_CADENCE;
}
