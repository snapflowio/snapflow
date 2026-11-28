/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { formatRelativeTime } from '#lib/components/resource/table/time-cell.ts';

const NOW_LABEL = 'Now';
const JUST_NOW_LABEL = 'just now';

export function relativeTimeLabel(value: string | Date, now = new Date()) {
	const label = formatRelativeTime(value, now);
	return label === NOW_LABEL ? JUST_NOW_LABEL : label;
}
