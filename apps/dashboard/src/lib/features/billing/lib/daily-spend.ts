/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { BillingDailyCostDto } from '@snapflow/api-client';
import { DISPLAY_LOCALE } from '#lib/utils/format.ts';
import { formatUsd, MICRO_USD_DECIMALS } from '#lib/utils/usd.ts';

export type DailySpendPoint = {
	date: string;
	compute: number;
	network: number;
};

const ISO_DATE_LENGTH = 'YYYY-MM-DD'.length;
const FIRST_DAY_OF_MONTH = 1;
const LAST_DAY_OF_PREVIOUS_MONTH = 0;
const MICRO_USD_PER_USD = 10 ** MICRO_USD_DECIMALS;
const SPEND_TICK_FORMAT = new Intl.NumberFormat(DISPLAY_LOCALE, {
	currency: 'USD',
	maximumFractionDigits: MICRO_USD_DECIMALS + 1,
	minimumFractionDigits: 0,
	style: 'currency',
});

export function dailySpendPoints(
	daily: readonly BillingDailyCostDto[],
	observedAt: Date
): DailySpendPoint[] {
	const costsByDate = new Map(daily.map((cost) => [cost.date, cost]));
	const year = observedAt.getUTCFullYear();
	const month = observedAt.getUTCMonth();
	const daysInMonth = new Date(
		Date.UTC(year, month + 1, LAST_DAY_OF_PREVIOUS_MONTH)
	).getUTCDate();
	const points: DailySpendPoint[] = [];
	for (let day = FIRST_DAY_OF_MONTH; day <= daysInMonth; day++) {
		const date = new Date(Date.UTC(year, month, day))
			.toISOString()
			.slice(0, ISO_DATE_LENGTH);
		const cost = costsByDate.get(date);
		points.push({
			date,
			compute: Number(cost?.computeMicroUsd ?? 0),
			network: Number(cost?.networkMicroUsd ?? 0),
		});
	}
	return points;
}

export function hasDailySpend(points: readonly DailySpendPoint[]): boolean {
	return points.some((point) => point.compute > 0 || point.network > 0);
}

export function hasNetworkSpend(points: readonly DailySpendPoint[]): boolean {
	return points.some((point) => point.network > 0);
}

export function formatSpendDay(date: string): string {
	return new Date(`${date}T00:00:00Z`).toLocaleDateString(DISPLAY_LOCALE, {
		day: 'numeric',
		month: 'short',
		timeZone: 'UTC',
	});
}

export function formatSpendValue(microUsd: number): string {
	return formatUsd(toWholeMicroUsd(microUsd).toString());
}

export function formatSpendTick(microUsd: number): string {
	return SPEND_TICK_FORMAT.format(microUsd / MICRO_USD_PER_USD);
}

function toWholeMicroUsd(value: number): bigint {
	return BigInt(Math.max(0, Math.round(value)));
}
