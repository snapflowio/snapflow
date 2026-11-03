/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	MILLISECONDS_PER_MINUTE,
	MINUTES_PER_HOUR,
} from '../../../../common/constants/time.constants';
import { millisecondsBetween } from '../../../../common/utils/time.util';
import { MicroUsd } from '../../../../common/values/micro-usd.value';
import { MINIMUM_BILLABLE_HOURLY_MICRO_USD } from '../../constants/billing-admission.constants';

export interface RecentNetworkUsage {
	totalMicroUsd: MicroUsd;
	startedAt: Date | null;
}

export interface NetworkRunwayReservationInput {
	recentUsage: RecentNetworkUsage;
	observedAt: Date;
	runwayMinutes: bigint;
	minimumMicroUsd: MicroUsd;
}

export function unusedReservedMicroUsd(
	reservations: readonly {
		placementId: string;
		remainingReservedMicroUsd: string;
	}[],
	liveAccrualByPlacement: ReadonlyMap<string, MicroUsd>
): MicroUsd {
	let total = MicroUsd.ZERO;
	for (const reservation of reservations) {
		const remaining = MicroUsd.parse(reservation.remainingReservedMicroUsd);
		if (remaining.isNegative()) {
			throw new Error('Placement reservation cannot be negative');
		}
		const liveAccrual =
			liveAccrualByPlacement.get(reservation.placementId) ?? MicroUsd.ZERO;
		total = total.add(remaining.subtract(liveAccrual).nonnegative());
	}
	return total;
}

export function computeRunwayReservationMicroUsd(
	hourlyMicroUsd: MicroUsd,
	runwayMinutes: bigint
): MicroUsd {
	return hourlyMicroUsd
		.multiply(runwayMinutes)
		.divideCeil(BigInt(MINUTES_PER_HOUR));
}

export function networkRunwayReservationMicroUsd({
	recentUsage,
	observedAt,
	runwayMinutes,
	minimumMicroUsd,
}: NetworkRunwayReservationInput): MicroUsd {
	if (!recentUsage.startedAt) return minimumMicroUsd;
	const observedMilliseconds = BigInt(
		Math.max(1, millisecondsBetween(recentUsage.startedAt, observedAt))
	);
	return recentUsage.totalMicroUsd
		.multiply(runwayMinutes * BigInt(MILLISECONDS_PER_MINUTE))
		.divideCeil(observedMilliseconds)
		.max(minimumMicroUsd);
}

export function minimumAdmissionReservationMicroUsd(
	networkReservationMicroUsd: MicroUsd,
	runwayMinutes: bigint
): MicroUsd {
	return networkReservationMicroUsd.add(
		computeRunwayReservationMicroUsd(
			MINIMUM_BILLABLE_HOURLY_MICRO_USD,
			runwayMinutes
		)
	);
}
