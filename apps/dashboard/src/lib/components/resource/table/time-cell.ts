/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { formatDate } from '#lib/utils/format.ts';
import { pluralize } from '#lib/utils/text.ts';
import type { ResourceCell } from './resource-table.ts';

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
export const RELATIVE_TIME_WINDOW_DAYS = 7;
const NOW_LABEL = 'Now';

type TimeInput = string | Date;

function relativeLabel(amount: number, unit: string, isPast: boolean): string {
	const label = pluralize(amount, unit);
	return isPast ? `${label} ago` : label;
}

export function formatRelativeTime(value: TimeInput, now = new Date()): string {
	const date = value instanceof Date ? value : new Date(value);
	const diff = now.getTime() - date.getTime();
	const absDiff = Math.abs(diff);
	const isPast = diff > 0;

	if (absDiff < MINUTE) return NOW_LABEL;
	if (absDiff < HOUR) {
		return relativeLabel(Math.floor(absDiff / MINUTE), 'minute', isPast);
	}
	if (absDiff < DAY) {
		return relativeLabel(Math.floor(absDiff / HOUR), 'hour', isPast);
	}
	if (absDiff < RELATIVE_TIME_WINDOW_DAYS * DAY) {
		return relativeLabel(Math.floor(absDiff / DAY), 'day', isPast);
	}
	return formatDate(date);
}

export function timeCell(
	dateValue: TimeInput | null | undefined
): Pick<ResourceCell, 'label'> {
	return { label: dateValue ? formatRelativeTime(dateValue) : null };
}
