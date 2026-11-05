/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	HALF_LIFE_DECAY_BASE,
	MACHINE_TRUST_POLICY,
} from '../../../billing/constants/machine-trust.constants';
import {
	MILLISECONDS_PER_SECOND,
	SECONDS_PER_HOUR,
} from '../../../common/constants/time.constants';
import { millisecondsBetween } from '../../../common/utils/time.util';
import { MACHINE_HEALTH_STALE_THRESHOLD_MS } from '../constants/machine.constants';
import { toBasisPoints } from './qualification/machine-trust-evaluation.util';

const HALF_LIFE_SECONDS =
	MACHINE_TRUST_POLICY.evidenceHalfLifeHours * SECONDS_PER_HOUR;
const ONLINE_CREDIT_SECONDS =
	MACHINE_HEALTH_STALE_THRESHOLD_MS / MILLISECONDS_PER_SECOND;

export interface MachineUptime {
	onlineSeconds: number;
	observedSeconds: number;
}

export function accumulateUptime(
	previous: MachineUptime,
	previousHeartbeatAt: Date | null,
	heartbeatAt: Date
): MachineUptime {
	if (!previousHeartbeatAt) return previous;
	const gapSeconds = Math.max(
		0,
		millisecondsBetween(previousHeartbeatAt, heartbeatAt) /
			MILLISECONDS_PER_SECOND
	);
	const decay = HALF_LIFE_DECAY_BASE ** (gapSeconds / HALF_LIFE_SECONDS);
	return {
		onlineSeconds:
			previous.onlineSeconds * decay +
			Math.min(gapSeconds, ONLINE_CREDIT_SECONDS),
		observedSeconds: previous.observedSeconds * decay + gapSeconds,
	};
}

export function uptimeBasisPoints(uptime: MachineUptime): number {
	return toBasisPoints(
		uptime.observedSeconds > 0
			? uptime.onlineSeconds / uptime.observedSeconds
			: 1
	);
}
