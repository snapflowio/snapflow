/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { SandboxDesiredState } from '../../sandbox/enums/sandbox-desired-state.enum';
import type { SandboxState } from '../../sandbox/enums/sandbox-state.enum';
import {
	DISK_ONLY_USAGE_STATES,
	FULL_USAGE_STATES,
	UsageMode,
} from '../constants/usage-lifecycle.constants';

const FULL_USAGE_STATE_SET: ReadonlySet<SandboxState> = new Set(
	FULL_USAGE_STATES
);
const DISK_ONLY_USAGE_STATE_SET: ReadonlySet<SandboxState> = new Set(
	DISK_ONLY_USAGE_STATES
);

export function usageModeForState(state: SandboxState): UsageMode | null {
	if (FULL_USAGE_STATE_SET.has(state)) return UsageMode.FULL;
	if (DISK_ONLY_USAGE_STATE_SET.has(state)) return UsageMode.DISK;
	return null;
}

export function sandboxUsageMode(sandbox: Sandbox | null): UsageMode | null {
	if (
		!sandbox?.machineId ||
		sandbox.desiredState === SandboxDesiredState.DESTROYED
	) {
		return null;
	}
	return usageModeForState(sandbox.state);
}
