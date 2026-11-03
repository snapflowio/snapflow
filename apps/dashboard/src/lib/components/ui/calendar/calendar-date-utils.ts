/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	CalendarDate,
	type DateValue,
	toCalendarDate,
} from '@internationalized/date';
import { DISPLAY_LOCALE } from '#lib/utils/format.ts';

export const DEFAULT_RANGE_START_TIME = '00:00';
export const DEFAULT_RANGE_END_TIME = '23:59';
export function parseDateValue(value: string | Date | undefined): Date | null {
	if (!value) return null;
	if (value instanceof Date)
		return Number.isNaN(value.getTime()) ? null : value;
	if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
		const [year, month, day] = value.slice(0, 10).split('-').map(Number);
		if (year === undefined || month === undefined || day === undefined)
			return null;
		return new Date(year, month - 1, day);
	}
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function formatDateLabel(value: string | Date | undefined): string {
	const date = parseDateValue(value);
	if (!date) return '';
	return date.toLocaleDateString(DISPLAY_LOCALE, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	});
}
export function formatDateRangeLabel(
	start: string | Date | undefined,
	end: string | Date | undefined
): string {
	const startDate = parseDateValue(start);
	const endDate = parseDateValue(end);
	if (!startDate && !endDate) return '';
	if (startDate && !endDate) return formatDateLabel(startDate);
	if (!startDate && endDate) return formatDateLabel(endDate);
	if (!startDate || !endDate) return '';
	const sameYear = startDate.getFullYear() === endDate.getFullYear();
	const startLabel = startDate.toLocaleDateString(DISPLAY_LOCALE, {
		month: 'short',
		day: 'numeric',
		...(sameYear ? {} : { year: 'numeric' }),
	});
	const endLabel = endDate.toLocaleDateString(DISPLAY_LOCALE, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	});
	return `${startLabel} - ${endLabel}`;
}
const ISO_TIME_START = 11;
const ISO_TIME_END = 16;
export function extractTime(
	value: string | Date | undefined,
	fallback: string
): string {
	return typeof value === 'string' && value.includes('T')
		? value.slice(ISO_TIME_START, ISO_TIME_END)
		: fallback;
}
export function calendarDateOf(date: Date): CalendarDate {
	return new CalendarDate(
		date.getFullYear(),
		date.getMonth() + 1,
		date.getDate()
	);
}
export function buildRangeBounds(
	start: DateValue,
	end: DateValue,
	options: {
		showTime: boolean;
		startTime: string;
		endTime: string;
	}
): {
	start: string;
	end: string;
} {
	const ordered =
		end.compare(start) < 0 ? { start: end, end: start } : { start, end };
	const startStr = toCalendarDate(ordered.start).toString();
	const endStr = toCalendarDate(ordered.end).toString();
	if (!options.showTime) return { start: startStr, end: endStr };
	let startTime = options.startTime;
	let endTime = options.endTime;
	if (startStr === endStr && startTime > endTime) {
		startTime = options.endTime;
		endTime = options.startTime;
	}
	return { start: `${startStr}T${startTime}`, end: `${endStr}T${endTime}:59` };
}
