/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SandboxDesiredState } from '../enums/sandbox-desired-state.enum';
import { SandboxState } from '../enums/sandbox-state.enum';

const TRANSITIONAL_RESPONSE_STATE: Partial<
	Record<SandboxState, Partial<Record<SandboxDesiredState, SandboxState>>>
> = {
	[SandboxState.STARTED]: {
		[SandboxDesiredState.STOPPED]: SandboxState.STOPPING,
		[SandboxDesiredState.DESTROYED]: SandboxState.DESTROYING,
	},
	[SandboxState.STOPPED]: {
		[SandboxDesiredState.STARTED]: SandboxState.STARTING,
		[SandboxDesiredState.DESTROYED]: SandboxState.DESTROYING,
		[SandboxDesiredState.ARCHIVED]: SandboxState.ARCHIVING,
	},
	[SandboxState.ARCHIVED]: {
		[SandboxDesiredState.STARTED]: SandboxState.RESTORING,
	},
	[SandboxState.UNKNOWN]: {
		[SandboxDesiredState.STARTED]: SandboxState.CREATING,
	},
};

export function deriveSandboxResponseState(
	state: SandboxState,
	desiredState?: SandboxDesiredState
): SandboxState {
	if (!desiredState) {
		return state;
	}
	return TRANSITIONAL_RESPONSE_STATE[state]?.[desiredState] ?? state;
}
