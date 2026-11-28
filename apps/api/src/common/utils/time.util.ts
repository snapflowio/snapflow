/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	MILLISECONDS_PER_DAY,
	MILLISECONDS_PER_MINUTE,
	MILLISECONDS_PER_SECOND,
} from '../constants/time.constants';

export function addMilliseconds(date: Date, milliseconds: number): Date {
	return new Date(date.getTime() + milliseconds);
}

export function addSeconds(date: Date, seconds: number): Date {
	return addMilliseconds(date, seconds * MILLISECONDS_PER_SECOND);
}

export function addMinutes(date: Date, minutes: number): Date {
	return addMilliseconds(date, minutes * MILLISECONDS_PER_MINUTE);
}

export function addDays(date: Date, days: number): Date {
	return addMilliseconds(date, days * MILLISECONDS_PER_DAY);
}

export function millisecondsBetween(start: Date, end: Date): number {
	return end.getTime() - start.getTime();
}
