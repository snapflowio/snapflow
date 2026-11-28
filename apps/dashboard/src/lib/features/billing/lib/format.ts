/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { DISPLAY_LOCALE } from '#lib/utils/format.ts';

const MINUTES_PER_HOUR = 60n;
const HOURS_PER_DAY = 24n;
const MAXIMUM_HOURS_SHOWN = 2n * HOURS_PER_DAY;

export function formatDurationMinutes(minutes: string): string {
	const value = BigInt(minutes);
	if (value < MINUTES_PER_HOUR) return `${value} min`;
	const hours = value / MINUTES_PER_HOUR;
	if (hours < MAXIMUM_HOURS_SHOWN) return `${hours} hr`;
	return `${hours / HOURS_PER_DAY} days`;
}

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3_600;
const SECONDS_PER_DAY = 86_400;

export function formatCountdown(totalSeconds: number): string {
	const seconds = Math.max(0, Math.floor(totalSeconds));
	const days = Math.floor(seconds / SECONDS_PER_DAY);
	const hours = Math.floor((seconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
	const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
	if (days > 0) return `${days} d ${hours} h`;
	if (hours > 0) return `${hours} h ${minutes} m`;
	return `${Math.max(1, Math.ceil(seconds / SECONDS_PER_MINUTE))} m`;
}

const OBSERVED_AT_FORMAT = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
	day: 'numeric',
	hour: 'numeric',
	minute: '2-digit',
	month: 'short',
	timeZone: 'UTC',
});

export function formatObservedAt(value: Date): string {
	return `${OBSERVED_AT_FORMAT.format(value)} UTC`;
}

const MONTH_START_SUFFIX = '-01T00:00:00Z';
const STATEMENT_MONTH_FORMAT = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
	month: 'long',
	timeZone: 'UTC',
	year: 'numeric',
});
const STATEMENT_PERIOD_FORMAT = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
	dateStyle: 'medium',
	timeZone: 'UTC',
});

export function formatStatementMonth(month: string): string {
	return STATEMENT_MONTH_FORMAT.format(
		new Date(`${month}${MONTH_START_SUFFIX}`)
	);
}

export function formatStatementPeriod(start: string, end: string): string {
	return STATEMENT_PERIOD_FORMAT.formatRange(new Date(start), new Date(end));
}
