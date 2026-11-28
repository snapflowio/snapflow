/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BUSINESS_DAY_TIME_ZONE } from '../../common/constants/business-day.constants';
import { MILLISECONDS_PER_HOUR } from '../../common/constants/time.constants';
import {
	addBusinessDays,
	calendarDateIn,
} from '../../common/utils/business-day.util';
import { addDays, addMilliseconds } from '../../common/utils/time.util';
import { DMCA_RESTORATION } from '../constants/abuse-report.constants';
import type { AbuseReport } from '../entities/abuse-report.entity';

const NEXT_DAY = 1;
const LAST_MILLISECOND = -1;
const RESTORATION_WINDOW_BUSINESS_DAYS =
	DMCA_RESTORATION.maximumBusinessDays - DMCA_RESTORATION.minimumBusinessDays;

function businessDate(instant: Date): Date {
	return calendarDateIn(instant, BUSINESS_DAY_TIME_ZONE);
}

function endOfDay(day: Date): Date {
	return addMilliseconds(addDays(day, NEXT_DAY), LAST_MILLISECOND);
}

function endOfBusinessDaysAfter(instant: Date, count: number): Date {
	return endOfDay(addBusinessDays(businessDate(instant), count));
}

export function counterNoticeForwardDueAt(receivedAt: Date): Date {
	return endOfBusinessDaysAfter(
		receivedAt,
		DMCA_RESTORATION.forwardWithinBusinessDays
	);
}

export function statutoryRestoreBy(receivedAt: Date): Date {
	return endOfBusinessDaysAfter(
		receivedAt,
		DMCA_RESTORATION.maximumBusinessDays
	);
}

export function counterNoticeForwardedLate({
	counterNoticeReceivedAt,
	restoreBy,
}: Pick<AbuseReport, 'counterNoticeReceivedAt' | 'restoreBy'>): boolean {
	return (
		counterNoticeReceivedAt !== null &&
		restoreBy !== null &&
		restoreBy > statutoryRestoreBy(counterNoticeReceivedAt)
	);
}

export function forwardedCounterNotice(receivedAt: Date, forwardedAt: Date) {
	const received = businessDate(receivedAt);
	const forwarded = businessDate(forwardedAt);
	const earliest = addBusinessDays(
		new Date(Math.max(received.getTime(), forwarded.getTime())),
		DMCA_RESTORATION.minimumBusinessDays
	);
	const restoreAfter = addMilliseconds(
		addDays(earliest, NEXT_DAY),
		DMCA_RESTORATION.restoreAfterHourUtc * MILLISECONDS_PER_HOUR
	);
	const statutory = statutoryRestoreBy(receivedAt);
	return {
		counterNoticeForwardedAt: forwardedAt,
		restoreAfter,
		restoreBy:
			restoreAfter <= statutory
				? statutory
				: endOfDay(addBusinessDays(earliest, RESTORATION_WINDOW_BUSINESS_DAYS)),
	};
}
