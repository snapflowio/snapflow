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
const RELATIVE_DAY_LIMIT = 2;

export function timeCell(
	dateValue: string | Date | null | undefined
): Pick<ResourceCell, 'label'> {
	if (!dateValue) {
		return { label: null };
	}

	const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
	const now = new Date();
	const diff = now.getTime() - date.getTime();
	const absDiff = Math.abs(diff);
	const isPast = diff > 0;

	if (absDiff < MINUTE) {
		return { label: 'Now' };
	}

	if (absDiff < HOUR) {
		const minutes = Math.floor(absDiff / MINUTE);
		return {
			label: isPast
				? `${pluralize(minutes, 'minute')} ago`
				: pluralize(minutes, 'minute'),
		};
	}

	if (absDiff < DAY) {
		const hours = Math.floor(absDiff / HOUR);
		return {
			label: isPast
				? `${pluralize(hours, 'hour')} ago`
				: pluralize(hours, 'hour'),
		};
	}

	if (absDiff < RELATIVE_DAY_LIMIT * DAY) {
		const days = Math.floor(absDiff / DAY);
		return {
			label: isPast ? `${pluralize(days, 'day')} ago` : pluralize(days, 'day'),
		};
	}

	return { label: formatDate(date) };
}
