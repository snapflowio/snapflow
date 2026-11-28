/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { pluralize } from './text.ts';

export const DISPLAY_LOCALE = 'en-US';
const BASIS_POINTS_PER_PERCENT = 100;
const MAXIMUM_PERCENT_FRACTION_DIGITS = 2;
const BYTES_PER_KIBIBYTE = 1024;
export const BYTES_PER_MEBIBYTE = BYTES_PER_KIBIBYTE * BYTES_PER_KIBIBYTE;
const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
const GIBIBYTE_EXPONENT = 3;
const BYTES_PER_GIBIBYTE = BYTES_PER_KIBIBYTE ** GIBIBYTE_EXPONENT;
const WHOLE_BYTE_VALUE_THRESHOLD = 10;
const SMALL_BYTE_VALUE_FRACTION_DIGITS = 1;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MINUTES_PER_DAY = MINUTES_PER_HOUR * HOURS_PER_DAY;

const DATE_TIME_FORMAT = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
	year: 'numeric',
	month: 'short',
	day: 'numeric',
	hour: 'numeric',
	minute: '2-digit',
	second: '2-digit',
	timeZoneName: 'short',
});
const DATE_FORMAT = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
	dateStyle: 'medium',
});
const COUNT_FORMAT = new Intl.NumberFormat(DISPLAY_LOCALE);
const PERCENT_FORMAT = new Intl.NumberFormat(DISPLAY_LOCALE, {
	maximumFractionDigits: MAXIMUM_PERCENT_FRACTION_DIGITS,
});

type DateInput = string | Date;

export function formatDateTime(value: DateInput): string {
	return DATE_TIME_FORMAT.format(new Date(value));
}

export function formatDate(value: DateInput): string {
	return DATE_FORMAT.format(new Date(value));
}

export function formatOptionalDateTime(
	value: DateInput | null | undefined,
	emptyLabel: string
): string {
	return value ? formatDateTime(value) : emptyLabel;
}

export function formatCount(value: number): string {
	return COUNT_FORMAT.format(value);
}

export function formatBasisPointsPercent(basisPoints: number): string {
	return `${PERCENT_FORMAT.format(basisPoints / BASIS_POINTS_PER_PERCENT)}%`;
}

export function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes < BYTES_PER_KIBIBYTE)
		return `${bytes} B`;
	let value = bytes;
	let unitIndex = 0;
	while (value >= BYTES_PER_KIBIBYTE && unitIndex < BYTE_UNITS.length - 1) {
		value /= BYTES_PER_KIBIBYTE;
		unitIndex += 1;
	}
	const fractionDigits =
		value >= WHOLE_BYTE_VALUE_THRESHOLD ? 0 : SMALL_BYTE_VALUE_FRACTION_DIGITS;
	return `${value.toFixed(fractionDigits)} ${BYTE_UNITS[unitIndex]}`;
}

export function formatGibibytes(bytes: number, fractionDigits: number): string {
	return `${(bytes / BYTES_PER_GIBIBYTE).toFixed(fractionDigits)} GiB`;
}

export function formatMinutes(totalMinutes: number): string {
	const days = Math.floor(totalMinutes / MINUTES_PER_DAY);
	const hours = Math.floor((totalMinutes % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
	const minutes = totalMinutes % MINUTES_PER_HOUR;
	const parts = [
		days > 0 ? pluralize(days, 'day') : null,
		hours > 0 ? pluralize(hours, 'hour') : null,
		minutes > 0 ? pluralize(minutes, 'minute') : null,
	].filter((part) => part !== null);
	return parts.length > 0 ? parts.join(' ') : pluralize(0, 'minute');
}

const MORE_SUFFIX = '+';

export function countLabel(
	count: number,
	singular: string,
	plural = `${singular}s`,
	hasMore = false
): string {
	const noun = count === 1 && !hasMore ? singular : plural;
	return `${formatCount(count)}${hasMore ? MORE_SUFFIX : ''} ${noun}`;
}
