/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Sandbox } from '../../entities/sandbox.entity';
import { SandboxState } from '../../enums/sandbox-state.enum';

const STATES_WITHOUT_A_RUNTIME = new Set<SandboxState>([
	SandboxState.ARCHIVED,
	SandboxState.DESTROYED,
	SandboxState.BUILD_FAILED,
]);

export function placementMachineId(
	sandbox: Pick<Sandbox, 'machineId' | 'state'>
): string | null {
	return STATES_WITHOUT_A_RUNTIME.has(sandbox.state)
		? null
		: (sandbox.machineId ?? null);
}
