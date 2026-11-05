/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SandboxLifecycle, SandboxRuntimeState } from '@snapflow/machine-proto';
import { SandboxDesiredState } from '../enums/sandbox-desired-state.enum';
import { SandboxState } from '../enums/sandbox-state.enum';

export const OBSERVED_TRANSITION = {
	NONE: 'none',
	STARTED: 'started',
	STOPPED: 'stopped',
	MIGRATED: 'migrated',
	RESIZED: 'resized',
	RECOVERED: 'recovered',
	PAUSED: 'paused',
	DESTROYED: 'destroyed',
	ARCHIVED: 'archived',
	EXITED: 'exited',
	FAILED: 'failed',
	CREATE_FAILED: 'create_failed',
	MIGRATION_FAILED: 'migration_failed',
	RESIZE_FAILED: 'resize_failed',
	RECOVERY_FAILED: 'recovery_failed',
} as const;
export type ObservedTransition =
	(typeof OBSERVED_TRANSITION)[keyof typeof OBSERVED_TRANSITION];

export const CONVERGENCE_OUTCOME = {
	PENDING: 'pending',
	SUCCEEDED: 'succeeded',
	FAILED: 'failed',
} as const;
export type ConvergenceOutcome =
	(typeof CONVERGENCE_OUTCOME)[keyof typeof CONVERGENCE_OUTCOME];

export type ActiveLifecycle = Exclude<
	SandboxLifecycle,
	SandboxLifecycle.UNSPECIFIED
>;

export const CONVERGED_RUNTIME_STATE: Readonly<
	Record<ActiveLifecycle, SandboxRuntimeState>
> = {
	[SandboxLifecycle.STARTED]: SandboxRuntimeState.STARTED,
	[SandboxLifecycle.STOPPED]: SandboxRuntimeState.STOPPED,
	[SandboxLifecycle.PAUSED]: SandboxRuntimeState.PAUSED,
	[SandboxLifecycle.DESTROYED]: SandboxRuntimeState.DESTROYED,
};

export const PENDING_RUNTIME_STATES: ReadonlySet<SandboxRuntimeState> = new Set(
	[SandboxRuntimeState.CREATING, SandboxRuntimeState.UNSPECIFIED]
);

export const STARTING_STATES: ReadonlySet<SandboxState> = new Set([
	SandboxState.CREATING,
	SandboxState.STARTING,
	SandboxState.RESTORING,
	SandboxState.RESUMING,
]);

export const SETTLED_RUNNING_STATES: ReadonlySet<SandboxState> = new Set([
	SandboxState.STARTED,
	SandboxState.PAUSED,
]);

export const FAILURE_ABSORBING_STATES: ReadonlySet<SandboxState> = new Set([
	SandboxState.ERROR,
	SandboxState.DESTROYED,
	SandboxState.ARCHIVED,
]);

export const STOPPED_CONVERGENCE_TRANSITION: Readonly<
	Partial<Record<SandboxState, ObservedTransition>>
> = {
	[SandboxState.STOPPING]: OBSERVED_TRANSITION.STOPPED,
	[SandboxState.RESTORING]: OBSERVED_TRANSITION.MIGRATED,
	[SandboxState.RESIZING]: OBSERVED_TRANSITION.RESIZED,
};

export const INTERRUPTED_OPERATION_FAILURE: Readonly<
	Partial<Record<SandboxState, ObservedTransition>>
> = {
	[SandboxState.CREATING]: OBSERVED_TRANSITION.CREATE_FAILED,
	[SandboxState.RESIZING]: OBSERVED_TRANSITION.RESIZE_FAILED,
};

export const RESTING_STATE_BY_DESIRED_STATE: Readonly<
	Partial<Record<SandboxDesiredState, SandboxState>>
> = {
	[SandboxDesiredState.STARTED]: SandboxState.STARTED,
	[SandboxDesiredState.STOPPED]: SandboxState.STOPPED,
};

export const ERRORED_SANDBOX_STATES: ReadonlySet<SandboxState> = new Set([
	SandboxState.ERROR,
	SandboxState.BUILD_FAILED,
]);

export const SYNCHRONIZATION_TERMINAL_STATES: ReadonlySet<SandboxState> =
	new Set([
		SandboxState.DESTROYED,
		SandboxState.BUILD_FAILED,
		SandboxState.RESIZING,
		SandboxState.SNAPSHOTTING,
		SandboxState.FORKING,
	]);

export const ERROR_RECOVERY_TARGETS: ReadonlySet<SandboxDesiredState> = new Set(
	[SandboxDesiredState.ARCHIVED, SandboxDesiredState.DESTROYED]
);
