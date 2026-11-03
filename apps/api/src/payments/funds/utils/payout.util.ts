/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MILLISECONDS_PER_DAY } from '../../../common/constants/time.constants';
import { addDays } from '../../../common/utils/time.util';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import { ISO_WEEKDAY } from '../../../settings/platform/constants/settings.constants';
import type { PaymentAccount } from '../entities/payment-account.entity';
import {
	PaymentAccountRequirementsStatus,
	PaymentAccountTransfersStatus,
} from '../enums/payment-account-status.enum';

const DAYS_PER_WEEK = ISO_WEEKDAY.SUNDAY;
const JAVASCRIPT_SUNDAY = 0;
const ISO_THURSDAY = 4;
const JANUARY = 0;
const FIRST_DAY_OF_MONTH = 1;
const FIRST_ISO_WEEK = 1;
const ISO_WEEK_SEPARATOR = '-W';
const ISO_WEEK_DIGITS = 2;

export const PAYOUT_ELIGIBLE_REQUIREMENTS: readonly PaymentAccountRequirementsStatus[] =
	[
		PaymentAccountRequirementsStatus.NONE,
		PaymentAccountRequirementsStatus.EVENTUALLY_DUE,
	];

export function payoutAccountEligible(
	account: Pick<
		PaymentAccount,
		'transfersStatus' | 'requirementsStatus' | 'payoutsBlockedReason'
	>
): boolean {
	return (
		account.transfersStatus === PaymentAccountTransfersStatus.ACTIVE &&
		PAYOUT_ELIGIBLE_REQUIREMENTS.includes(account.requirementsStatus) &&
		account.payoutsBlockedReason === null
	);
}

export interface PayoutAmount {
	amountCents: number;
	amountMicroUsd: MicroUsd;
}

export function payoutAmount(
	availableMicroUsd: MicroUsd,
	payoutMinimumCents: number
): PayoutAmount | null {
	const amountCents = availableMicroUsd.isPositive()
		? availableMicroUsd.wholeCents()
		: 0;
	if (amountCents <= 0 || amountCents < payoutMinimumCents) return null;
	return { amountCents, amountMicroUsd: MicroUsd.fromCents(amountCents) };
}

export function isoWeekday(date: Date): number {
	const day = date.getUTCDay();
	return day === JAVASCRIPT_SUNDAY ? ISO_WEEKDAY.SUNDAY : day;
}

export function startOfUtcDay(date: Date): Date {
	return new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
	);
}

// ISO 8601 week identifier such as 2026-W43; a week belongs to the year of its Thursday.
export function isoWeekId(date: Date): string {
	const day = startOfUtcDay(date);
	const thursday = addDays(day, ISO_THURSDAY - isoWeekday(day));
	const year = thursday.getUTCFullYear();
	const week =
		Math.floor(
			(thursday.getTime() - Date.UTC(year, JANUARY, FIRST_DAY_OF_MONTH)) /
				MILLISECONDS_PER_DAY /
				DAYS_PER_WEEK
		) + FIRST_ISO_WEEK;
	return `${year}${ISO_WEEK_SEPARATOR}${String(week).padStart(ISO_WEEK_DIGITS, '0')}`;
}

export function nextPayoutDate(now: Date, payoutWeekday: number): Date {
	const today = startOfUtcDay(now);
	const daysAhead =
		(payoutWeekday - isoWeekday(today) + DAYS_PER_WEEK) % DAYS_PER_WEEK ||
		DAYS_PER_WEEK;
	return addDays(today, daysAhead);
}
