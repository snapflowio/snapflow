/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const Weekday = {
	SUNDAY: 0,
	MONDAY: 1,
	THURSDAY: 4,
	FRIDAY: 5,
	SATURDAY: 6,
} as const;

export const DAYS_PER_WEEK = 7;

export const Month = {
	JANUARY: 0,
	FEBRUARY: 1,
	MAY: 4,
	JUNE: 5,
	JULY: 6,
	SEPTEMBER: 8,
	OCTOBER: 9,
	NOVEMBER: 10,
	DECEMBER: 11,
} as const;

export const LAST_OCCURRENCE = -1;

export const US_FEDERAL_HOLIDAYS = [
	{ kind: 'fixed', month: Month.JANUARY, day: 1 },
	{ kind: 'weekday', month: Month.JANUARY, weekday: Weekday.MONDAY, nth: 3 },
	{ kind: 'weekday', month: Month.FEBRUARY, weekday: Weekday.MONDAY, nth: 3 },
	{
		kind: 'weekday',
		month: Month.MAY,
		weekday: Weekday.MONDAY,
		nth: LAST_OCCURRENCE,
	},
	{ kind: 'fixed', month: Month.JUNE, day: 19 },
	{ kind: 'fixed', month: Month.JULY, day: 4 },
	{ kind: 'weekday', month: Month.SEPTEMBER, weekday: Weekday.MONDAY, nth: 1 },
	{ kind: 'weekday', month: Month.OCTOBER, weekday: Weekday.MONDAY, nth: 2 },
	{ kind: 'fixed', month: Month.NOVEMBER, day: 11 },
	{
		kind: 'weekday',
		month: Month.NOVEMBER,
		weekday: Weekday.THURSDAY,
		nth: 4,
	},
	{ kind: 'fixed', month: Month.DECEMBER, day: 25 },
] as const;

export const BUSINESS_DAY_TIME_ZONE = 'America/New_York';
