/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SandboxState } from '../enums/sandbox-state.enum';

export const SandboxResourceHold = {
	COMPUTE: 'compute',
	COMPUTE_WHEN_STARTED: 'compute_when_started',
	DISK: 'disk',
	NONE: 'none',
} as const;

export type SandboxResourceHold =
	(typeof SandboxResourceHold)[keyof typeof SandboxResourceHold];

export type SandboxHoldMap = Readonly<
	Record<SandboxState, SandboxResourceHold>
>;

export const SANDBOX_CAPACITY_HOLD = {
	[SandboxState.UNKNOWN]: SandboxResourceHold.COMPUTE,
	[SandboxState.PENDING_BUILD]: SandboxResourceHold.COMPUTE,
	[SandboxState.PENDING_PLACEMENT]: SandboxResourceHold.COMPUTE,
	[SandboxState.BUILDING_SNAPSHOT]: SandboxResourceHold.COMPUTE,
	[SandboxState.CREATING]: SandboxResourceHold.COMPUTE,
	[SandboxState.STARTING]: SandboxResourceHold.COMPUTE,
	[SandboxState.STARTED]: SandboxResourceHold.COMPUTE,
	[SandboxState.STOPPING]: SandboxResourceHold.COMPUTE,
	[SandboxState.PAUSING]: SandboxResourceHold.COMPUTE,
	[SandboxState.RESUMING]: SandboxResourceHold.COMPUTE,
	[SandboxState.RESTORING]: SandboxResourceHold.COMPUTE_WHEN_STARTED,
	[SandboxState.RESIZING]: SandboxResourceHold.COMPUTE_WHEN_STARTED,
	[SandboxState.SNAPSHOTTING]: SandboxResourceHold.COMPUTE_WHEN_STARTED,
	[SandboxState.FORKING]: SandboxResourceHold.COMPUTE_WHEN_STARTED,
	[SandboxState.STOPPED]: SandboxResourceHold.DISK,
	[SandboxState.PAUSED]: SandboxResourceHold.DISK,
	[SandboxState.ARCHIVING]: SandboxResourceHold.DISK,
	[SandboxState.ERROR]: SandboxResourceHold.NONE,
	[SandboxState.MACHINE_UNAVAILABLE]: SandboxResourceHold.NONE,
	[SandboxState.BUILD_FAILED]: SandboxResourceHold.NONE,
	[SandboxState.ARCHIVED]: SandboxResourceHold.NONE,
	[SandboxState.DESTROYING]: SandboxResourceHold.NONE,
	[SandboxState.DESTROYED]: SandboxResourceHold.NONE,
} as const satisfies SandboxHoldMap;

export const SANDBOX_BILLING_HOLD = {
	[SandboxState.UNKNOWN]: SandboxResourceHold.NONE,
	[SandboxState.PENDING_BUILD]: SandboxResourceHold.NONE,
	[SandboxState.PENDING_PLACEMENT]: SandboxResourceHold.NONE,
	[SandboxState.BUILDING_SNAPSHOT]: SandboxResourceHold.NONE,
	[SandboxState.CREATING]: SandboxResourceHold.NONE,
	[SandboxState.RESTORING]: SandboxResourceHold.NONE,
	[SandboxState.STARTING]: SandboxResourceHold.DISK,
	[SandboxState.RESUMING]: SandboxResourceHold.DISK,
	[SandboxState.STARTED]: SandboxResourceHold.COMPUTE,
	[SandboxState.FORKING]: SandboxResourceHold.COMPUTE_WHEN_STARTED,
	[SandboxState.SNAPSHOTTING]: SandboxResourceHold.COMPUTE_WHEN_STARTED,
	[SandboxState.RESIZING]: SandboxResourceHold.COMPUTE_WHEN_STARTED,
	[SandboxState.STOPPING]: SandboxResourceHold.DISK,
	[SandboxState.PAUSING]: SandboxResourceHold.DISK,
	[SandboxState.STOPPED]: SandboxResourceHold.DISK,
	[SandboxState.PAUSED]: SandboxResourceHold.DISK,
	[SandboxState.ARCHIVING]: SandboxResourceHold.DISK,
	[SandboxState.ERROR]: SandboxResourceHold.NONE,
	[SandboxState.MACHINE_UNAVAILABLE]: SandboxResourceHold.NONE,
	[SandboxState.BUILD_FAILED]: SandboxResourceHold.NONE,
	[SandboxState.ARCHIVED]: SandboxResourceHold.NONE,
	[SandboxState.DESTROYING]: SandboxResourceHold.NONE,
	[SandboxState.DESTROYED]: SandboxResourceHold.NONE,
} as const satisfies SandboxHoldMap;
