/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SandboxDesiredState } from '../../enums/sandbox-desired-state.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';
import type { SandboxStateFields } from '../../types/sandbox-state-fields.types';

export function awaitsAutomaticRestart(
	sandbox: Pick<SandboxStateFields, 'state' | 'desiredState' | 'stopReason'>
): boolean {
	return (
		sandbox.state === SandboxState.STOPPED &&
		sandbox.desiredState === SandboxDesiredState.STARTED &&
		sandbox.stopReason !== null
	);
}
