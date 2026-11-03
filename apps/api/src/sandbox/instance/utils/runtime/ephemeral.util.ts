/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SandboxMode } from '../../enums/sandbox-mode.enum';

const DELETE_ON_STOP_INTERVAL_MINUTES = 0;
const AUTO_DELETE_DISABLED_INTERVAL_MINUTES = -1;

export interface SandboxModeInput {
	mode: SandboxMode;
}

export function isEphemeral(sandbox: SandboxModeInput): boolean {
	return sandbox.mode === SandboxMode.EPHEMERAL;
}

export function deletesImmediatelyOnStop(sandbox: {
	autoDeleteInterval?: number;
}): boolean {
	return sandbox.autoDeleteInterval === DELETE_ON_STOP_INTERVAL_MINUTES;
}

export function autoDeleteIntervalMatchesMode(
	mode: SandboxMode,
	requestedInterval?: number
): boolean {
	return (
		requestedInterval === undefined ||
		isEphemeral({ mode }) ===
			deletesImmediatelyOnStop({ autoDeleteInterval: requestedInterval })
	);
}

export function resolveAutoDeleteInterval(
	mode: SandboxMode,
	requestedInterval?: number
): number {
	if (requestedInterval !== undefined) {
		return requestedInterval;
	}

	return mode === SandboxMode.EPHEMERAL
		? DELETE_ON_STOP_INTERVAL_MINUTES
		: AUTO_DELETE_DISABLED_INTERVAL_MINUTES;
}
