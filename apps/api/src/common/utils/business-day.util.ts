/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	DAYS_PER_WEEK,
	LAST_OCCURRENCE,
	US_FEDERAL_HOLIDAYS,
	Weekday,
} from '../constants/business-day.constants';
import { addDays } from './time.util';

type Holiday = (typeof US_FEDERAL_HOLIDAYS)[number];

const DATE_PARTS_LOCALE = 'en-CA';
const FIRST_DAY_OF_MONTH = 1;
const LAST_DAY_OF_PREVIOUS_MONTH = 0;
const MONTH_STEP = 1;
const FIRST_OCCURRENCE = 1;
const DAY_STEP = 1;

function utcDate(year: number, month: number, day: number): Date {
	return new Date(Date.UTC(year, month, day));
}

function weekdayInMonth(
	year: number,
	month: number,
	weekday: number,
	nth: number
): Date {
	if (nth === LAST_OCCURRENCE) {
		const last = utcDate(year, month + MONTH_STEP, LAST_DAY_OF_PREVIOUS_MONTH);
		return addDays(
			last,
			-((last.getUTCDay() - weekday + DAYS_PER_WEEK) % DAYS_PER_WEEK)
		);
	}
	const first = utcDate(year, month, FIRST_DAY_OF_MONTH);
	const offset = (weekday - first.getUTCDay() + DAYS_PER_WEEK) % DAYS_PER_WEEK;
	return addDays(first, offset + (nth - FIRST_OCCURRENCE) * DAYS_PER_WEEK);
}

function observed(date: Date): Date {
	switch (date.getUTCDay()) {
		case Weekday.SATURDAY:
			return addDays(date, -DAY_STEP);
		case Weekday.SUNDAY:
			return addDays(date, DAY_STEP);
		default:
			return date;
	}
}

function holidayDate(year: number, holiday: Holiday): Date {
	return holiday.kind === 'fixed'
		? utcDate(year, holiday.month, holiday.day)
		: weekdayInMonth(year, holiday.month, holiday.weekday, holiday.nth);
}

function observedHolidays(year: number): ReadonlySet<number> {
	return new Set(
		[year, year + DAY_STEP].flatMap((holidayYear) =>
			US_FEDERAL_HOLIDAYS.map((holiday) =>
				observed(holidayDate(holidayYear, holiday)).getTime()
			)
		)
	);
}

export function isBusinessDay(date: Date): boolean {
	const weekday = date.getUTCDay();
	return (
		weekday !== Weekday.SATURDAY &&
		weekday !== Weekday.SUNDAY &&
		!observedHolidays(date.getUTCFullYear()).has(date.getTime())
	);
}

export function addBusinessDays(date: Date, count: number): Date {
	let current = date;
	let remaining = count;
	while (remaining > 0) {
		current = addDays(current, DAY_STEP);
		if (isBusinessDay(current)) remaining -= DAY_STEP;
	}
	return current;
}

export function calendarDateIn(instant: Date, timeZone: string): Date {
	const parts = new Intl.DateTimeFormat(DATE_PARTS_LOCALE, {
		timeZone,
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
	}).formatToParts(instant);
	const part = (type: Intl.DateTimeFormatPartTypes) =>
		Number(parts.find((candidate) => candidate.type === type)?.value);
	return utcDate(part('year'), part('month') - MONTH_STEP, part('day'));
}
