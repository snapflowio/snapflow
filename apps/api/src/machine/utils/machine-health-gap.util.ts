/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MACHINE_HEALTH_STALE_THRESHOLD_MS } from '../constants/machine.constants';

export interface HealthGap {
	startAt: Date;
	endAt: Date;
}

export function recoveredHealthGap(
	previousHealthyAt: Date | null,
	healthyAt: Date | undefined
): HealthGap | null {
	if (previousHealthyAt === null || healthyAt === undefined) return null;
	return healthyAt.getTime() - previousHealthyAt.getTime() >
		MACHINE_HEALTH_STALE_THRESHOLD_MS
		? { startAt: previousHealthyAt, endAt: healthyAt }
		: null;
}
