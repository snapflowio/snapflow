/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { MachineUsageReading } from '../../../../usage/metering/utils/evidence/machine-usage-meter.util';
import type { SandboxPlacement } from '../../../instance/entities/sandbox-placement.entity';
import {
	MACHINE_USAGE_COUNTER_GRACE_MILLISECONDS,
	MACHINE_USAGE_MAX_CLOCK_SKEW_MILLISECONDS,
	MACHINE_USAGE_RECONCILIATION_DEADLINE_MILLISECONDS,
	MACHINE_USAGE_RELEASE_GRACE_MILLISECONDS,
} from '../../constants/machine-usage.constants';
import { MachineUsageEvidenceError } from '../../exceptions/machine-usage-evidence.exception';

export function assertMachineUsageClock(
	placement: Pick<SandboxPlacement, 'placedAt' | 'releasedAt'>,
	reading: Pick<MachineUsageReading, 'sampledAt' | 'runningMillis'>,
	observedAt: Date
): void {
	const sampledAt = reading.sampledAt.getTime();
	const leadMillis = sampledAt - observedAt.getTime();
	if (
		leadMillis > MACHINE_USAGE_MAX_CLOCK_SKEW_MILLISECONDS ||
		-leadMillis >
			MACHINE_USAGE_MAX_CLOCK_SKEW_MILLISECONDS +
				MACHINE_USAGE_RECONCILIATION_DEADLINE_MILLISECONDS
	) {
		throw new MachineUsageEvidenceError(
			'Usage receipt is outside the tolerated clock skew'
		);
	}
	const placedAt = placement.placedAt.getTime();
	const latest =
		(placement.releasedAt?.getTime() ?? observedAt.getTime()) +
		MACHINE_USAGE_RELEASE_GRACE_MILLISECONDS;
	if (
		sampledAt < placedAt - MACHINE_USAGE_MAX_CLOCK_SKEW_MILLISECONDS ||
		sampledAt > latest
	) {
		throw new MachineUsageEvidenceError(
			'Usage receipt is outside its placement window'
		);
	}
	const maximumRunningMillis = BigInt(
		Math.max(0, observedAt.getTime() - placedAt) +
			MACHINE_USAGE_COUNTER_GRACE_MILLISECONDS
	);
	if (reading.runningMillis > maximumRunningMillis) {
		throw new MachineUsageEvidenceError(
			'Usage receipt running time exceeds placement age'
		);
	}
}
