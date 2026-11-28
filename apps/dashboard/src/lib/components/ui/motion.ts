/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { cubicBezier } from 'motion';

export const MotionToken = {
	QUICK: '--motion-quick',
	STANDARD: '--motion-standard',
	EMPHASIS: '--motion-emphasis',
} as const;

export type MotionToken = (typeof MotionToken)[keyof typeof MotionToken];

const MILLISECONDS_PER_SECOND = 1000;
const MILLISECONDS_SUFFIX = 'ms';
const SECONDS_SUFFIX = 's';

const EASE_EXIT_X1 = 0.3;
const EASE_STANDARD_X1 = 0.2;

export const EASE_ENTER = [0, 0, 0, 1] as const;
export const EASE_EXIT = [EASE_EXIT_X1, 0, 1, 1] as const;
export const EASE_STANDARD = [EASE_STANDARD_X1, 0, 0, 1] as const;

export const easeEnter = cubicBezier(...EASE_ENTER);
export const easeStandard = cubicBezier(...EASE_STANDARD);

export function motionDuration(token: MotionToken): number {
	const value = getComputedStyle(document.documentElement)
		.getPropertyValue(token)
		.trim();
	const amount = Number.parseFloat(value);
	if (!Number.isFinite(amount)) return 0;
	if (value.endsWith(MILLISECONDS_SUFFIX)) return amount;
	if (value.endsWith(SECONDS_SUFFIX)) return amount * MILLISECONDS_PER_SECOND;
	return amount;
}

export function motionSeconds(token: MotionToken): number {
	return motionDuration(token) / MILLISECONDS_PER_SECOND;
}
