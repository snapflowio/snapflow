/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const WEEK_DAYS = 7;
const MONTH_DAYS = 30;

export const MINIMUM_DURATION_MINUTES = 1;

export function durationMinuteOptions(indefiniteLabel: string) {
	return [
		{ label: indefiniteLabel, value: '' },
		{ label: '1 hour', value: String(MINUTES_PER_HOUR) },
		{ label: '1 day', value: String(MINUTES_PER_DAY) },
		{ label: '7 days', value: String(WEEK_DAYS * MINUTES_PER_DAY) },
		{ label: '30 days', value: String(MONTH_DAYS * MINUTES_PER_DAY) },
	];
}
