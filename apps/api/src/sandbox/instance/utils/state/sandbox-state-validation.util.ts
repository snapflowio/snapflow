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

const states = (...values: SandboxState[]): ReadonlySet<SandboxState> =>
	new Set(values);

const VALID_STATES_BY_DESIRED_STATE = {
	[SandboxDesiredState.STARTED]: states(
		SandboxState.STARTED,
		SandboxState.STOPPED,
		SandboxState.STARTING,
		SandboxState.ARCHIVED,
		SandboxState.CREATING,
		SandboxState.UNKNOWN,
		SandboxState.RESTORING,
		SandboxState.PENDING_BUILD,
		SandboxState.BUILDING_SNAPSHOT,
		SandboxState.ARCHIVING,
		SandboxState.ERROR,
		SandboxState.BUILD_FAILED,
		SandboxState.RESIZING,
		SandboxState.SNAPSHOTTING,
		SandboxState.FORKING,
		SandboxState.PAUSED,
		SandboxState.RESUMING
	),
	[SandboxDesiredState.STOPPED]: states(
		SandboxState.STARTED,
		SandboxState.STOPPING,
		SandboxState.STOPPED,
		SandboxState.ERROR,
		SandboxState.BUILD_FAILED,
		SandboxState.RESIZING,
		SandboxState.SNAPSHOTTING,
		SandboxState.FORKING,
		SandboxState.PAUSED,
		SandboxState.PAUSING,
		SandboxState.RESTORING
	),
	[SandboxDesiredState.RESIZED]: states(...Object.values(SandboxState)),
	[SandboxDesiredState.ARCHIVED]: states(
		SandboxState.ARCHIVED,
		SandboxState.ARCHIVING,
		SandboxState.STOPPED,
		SandboxState.ERROR,
		SandboxState.BUILD_FAILED
	),
	[SandboxDesiredState.DESTROYED]: states(
		SandboxState.DESTROYED,
		SandboxState.DESTROYING,
		SandboxState.STOPPED,
		SandboxState.STARTED,
		SandboxState.ARCHIVED,
		SandboxState.ERROR,
		SandboxState.BUILD_FAILED,
		SandboxState.ARCHIVING,
		SandboxState.PENDING_BUILD,
		SandboxState.PAUSED
	),
	[SandboxDesiredState.PAUSED]: states(
		SandboxState.STARTED,
		SandboxState.PAUSING,
		SandboxState.PAUSED,
		SandboxState.ERROR
	),
} as const satisfies Record<SandboxDesiredState, ReadonlySet<SandboxState>>;

export function sandboxDesiredStateAcceptsState(
	desiredState: SandboxDesiredState,
	state: SandboxState
): boolean {
	return VALID_STATES_BY_DESIRED_STATE[desiredState].has(state);
}

export function assertSandboxDesiredStateAcceptsState(
	sandbox: Pick<SandboxStateFields, 'id' | 'desiredState' | 'state'>
): void {
	if (!sandboxDesiredStateAcceptsState(sandbox.desiredState, sandbox.state)) {
		throw new Error(
			`Sandbox ${sandbox.id} cannot reconcile desired state ${sandbox.desiredState} from state ${sandbox.state}`
		);
	}
}
