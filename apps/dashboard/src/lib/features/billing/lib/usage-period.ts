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

export const USAGE_PERIOD = {
	TODAY: '1d',
	WEEK: '7d',
	MONTH: '30d',
	ALL: 'all',
	CUSTOM: 'custom',
} as const;

export type UsagePeriod = (typeof USAGE_PERIOD)[keyof typeof USAGE_PERIOD];

export const USAGE_PERIOD_OPTIONS = [
	{ value: USAGE_PERIOD.TODAY, label: 'Today' },
	{ value: USAGE_PERIOD.WEEK, label: 'Last 7 days' },
	{ value: USAGE_PERIOD.MONTH, label: 'Last 30 days' },
	{ value: USAGE_PERIOD.ALL, label: 'All time' },
	{ value: USAGE_PERIOD.CUSTOM, label: 'Custom range' },
] as const satisfies readonly ChipOption<UsagePeriod>[];

const ROLLING_PERIOD_DAYS = {
	[USAGE_PERIOD.WEEK]: 7,
	[USAGE_PERIOD.MONTH]: 30,
} as const;

const MILLISECONDS_PER_MINUTE = 60_000;
const MILLISECONDS_PER_DAY = 86_400_000;

const dateParam = z
	.string()
	.refine((value) => !value || !Number.isNaN(Date.parse(value)))
	.catch('');

export const usagePeriodSearchSchema = z.object({
	period: z
		.enum([
			USAGE_PERIOD.TODAY,
			USAGE_PERIOD.WEEK,
			USAGE_PERIOD.MONTH,
			USAGE_PERIOD.ALL,
			USAGE_PERIOD.CUSTOM,
		])
		.catch(USAGE_PERIOD.MONTH),
	from: dateParam,
	to: dateParam,
});

export type UsagePeriodSelection = z.infer<typeof usagePeriodSearchSchema>;

export interface UsageWindow {
	from?: string;
	to?: string;
}

function startOfMinute(now: Date): number {
	return (
		Math.floor(now.getTime() / MILLISECONDS_PER_MINUTE) *
		MILLISECONDS_PER_MINUTE
	);
}

function startOfDay(now: Date): Date {
	return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function usageWindow(
	selection: UsagePeriodSelection,
	now = new Date()
): UsageWindow {
	switch (selection.period) {
		case USAGE_PERIOD.ALL:
			return {};
		case USAGE_PERIOD.TODAY:
			return { from: startOfDay(now).toISOString() };
		case USAGE_PERIOD.CUSTOM:
			return {
				from: selection.from
					? new Date(selection.from).toISOString()
					: undefined,
				to: selection.to ? new Date(selection.to).toISOString() : undefined,
			};
		default:
			return {
				from: new Date(
					startOfMinute(now) -
						ROLLING_PERIOD_DAYS[selection.period] * MILLISECONDS_PER_DAY
				).toISOString(),
			};
	}
}
