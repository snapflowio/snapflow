/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MACHINE_HEALTH_STALE_THRESHOLD_MS } from '../../machine/constants/machine.constants';
import type { HealthGap } from '../../machine/utils/machine-health-gap.util';

export interface UsageWindow {
	startAt: Date;
	endAt: Date;
	minimumMillis: number;
}

export interface BillableWindow {
	endAt: Date;
	durationMillis: bigint;
}

export function billableWindow(
	window: UsageWindow,
	lastHealthyAt: Date | null,
	gaps: readonly HealthGap[] = []
): BillableWindow {
	const silent =
		lastHealthyAt !== null &&
		lastHealthyAt.getTime() + MACHINE_HEALTH_STALE_THRESHOLD_MS <
			window.endAt.getTime();
	const endAt = silent
		? new Date(Math.max(window.startAt.getTime(), lastHealthyAt.getTime()))
		: window.endAt;
	const outage = coveredMillis(gaps, window.startAt, endAt);
	const elapsed = endAt.getTime() - window.startAt.getTime() - outage;
	const interrupted = silent || outage > 0;
	return {
		endAt,
		durationMillis: BigInt(
			interrupted ? elapsed : Math.max(elapsed, window.minimumMillis)
		),
	};
}

function coveredMillis(
	gaps: readonly HealthGap[],
	from: Date,
	to: Date
): number {
	const clipped = gaps
		.map((gap) => ({
			startAt: Math.max(gap.startAt.getTime(), from.getTime()),
			endAt: Math.min(gap.endAt.getTime(), to.getTime()),
		}))
		.filter((gap) => gap.endAt > gap.startAt)
		.sort((left, right) => left.startAt - right.startAt);
	let covered = 0;
	let reached = from.getTime();
	for (const gap of clipped) {
		const startAt = Math.max(gap.startAt, reached);
		if (gap.endAt > startAt) covered += gap.endAt - startAt;
		reached = Math.max(reached, gap.endAt);
	}
	return covered;
}

export function remainingMinimum(
	minimumMillis: number,
	elapsedMillis: number
): number {
	return Math.max(0, minimumMillis - elapsedMillis);
}
