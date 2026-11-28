/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import * as z from 'zod';
import type { ChipOption } from '#lib/components/ui/chip/chip-selection.ts';
import { DISPLAY_LOCALE } from '#lib/utils/format.ts';
import {
	USAGE_PERIOD,
	USAGE_PERIOD_OPTIONS,
	type UsageWindow,
	usageWindow,
} from './usage-period.ts';

export const CALENDAR_MONTH_PERIOD = 'month';
export const USAGE_RECORD_PARAM = 'id';

export const BILLING_USAGE_PERIOD_OPTIONS = [
	{ value: CALENDAR_MONTH_PERIOD, label: 'Calendar month' },
	...USAGE_PERIOD_OPTIONS,
] as const satisfies readonly ChipOption[];

const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;
const MONTH_DIGITS = 2;

const MONTH_LABEL_FORMAT = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
	month: 'short',
	year: 'numeric',
	timeZone: 'UTC',
});

const dateParam = z
	.string()
	.refine((value) => !value || !Number.isNaN(Date.parse(value)))
	.catch('');

export const billingUsageSearchSchema = z.object({
	period: z
		.enum([
			CALENDAR_MONTH_PERIOD,
			USAGE_PERIOD.TODAY,
			USAGE_PERIOD.WEEK,
			USAGE_PERIOD.MONTH,
			USAGE_PERIOD.ALL,
			USAGE_PERIOD.CUSTOM,
		])
		.catch(CALENDAR_MONTH_PERIOD),
	month: z.string().regex(MONTH_KEY_PATTERN).catch(''),
	from: dateParam,
	to: dateParam,
});

export type BillingUsageSelection = z.infer<typeof billingUsageSearchSchema>;
export type BillingUsagePeriod = BillingUsageSelection['period'];

export function monthKey(date: Date): string {
	const month = String(date.getUTCMonth() + 1).padStart(MONTH_DIGITS, '0');
	return `${date.getUTCFullYear()}-${month}`;
}

function monthStart(key: string): Date {
	const [year = '', month = ''] = key.split('-');
	return new Date(Date.UTC(Number(year), Number(month) - 1, 1));
}

export function selectedMonth(
	selection: BillingUsageSelection,
	now = new Date()
): string {
	return selection.month || monthKey(now);
}

export function shiftMonth(key: string, offset: number): string {
	const start = monthStart(key);
	return monthKey(
		new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + offset, 1))
	);
}

export function formatMonthKey(key: string): string {
	return MONTH_LABEL_FORMAT.format(monthStart(key));
}

export function billingUsageWindow(
	selection: BillingUsageSelection,
	now = new Date()
): UsageWindow {
	if (selection.period !== CALENDAR_MONTH_PERIOD) {
		return usageWindow({ ...selection, period: selection.period }, now);
	}
	const key = selectedMonth(selection, now);
	return {
		from: monthStart(key).toISOString(),
		to: monthStart(shiftMonth(key, 1)).toISOString(),
	};
}
