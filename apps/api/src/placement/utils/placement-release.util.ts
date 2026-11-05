/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LeaseEndReason } from '../../marketplace/enums/lease-end-reason.enum';
import { SandboxState } from '../../sandbox/enums/sandbox-state.enum';

export const PLACEMENT_RELEASE_REASON = {
	ARCHIVED: 'archived',
	DESTROYED: 'destroyed',
	REASSIGNED: 'reassigned',
	RESIZED: 'resized',
	UNASSIGNED: 'unassigned',
	CREATE_FAILED: 'create_failed',
	BUILD_FAILED: 'build_failed',
} as const;

export type PlacementReleaseReason =
	(typeof PLACEMENT_RELEASE_REASON)[keyof typeof PLACEMENT_RELEASE_REASON];

const TERMINAL_RELEASE_REASONS: ReadonlyMap<
	SandboxState,
	PlacementReleaseReason
> = new Map([
	[SandboxState.ARCHIVED, PLACEMENT_RELEASE_REASON.ARCHIVED],
	[SandboxState.DESTROYED, PLACEMENT_RELEASE_REASON.DESTROYED],
	[SandboxState.BUILD_FAILED, PLACEMENT_RELEASE_REASON.BUILD_FAILED],
]);

const LEASE_END_REASONS: Readonly<
	Record<PlacementReleaseReason, LeaseEndReason>
> = {
	[PLACEMENT_RELEASE_REASON.ARCHIVED]: LeaseEndReason.ARCHIVED,
	[PLACEMENT_RELEASE_REASON.DESTROYED]: LeaseEndReason.DESTROYED,
	[PLACEMENT_RELEASE_REASON.REASSIGNED]: LeaseEndReason.REASSIGNED,
	[PLACEMENT_RELEASE_REASON.RESIZED]: LeaseEndReason.RESIZED,
	[PLACEMENT_RELEASE_REASON.UNASSIGNED]: LeaseEndReason.RELEASED,
	[PLACEMENT_RELEASE_REASON.CREATE_FAILED]: LeaseEndReason.RELEASED,
	[PLACEMENT_RELEASE_REASON.BUILD_FAILED]: LeaseEndReason.RELEASED,
};

export function placementReleaseReason(
	state: SandboxState,
	releasedMachineId: string,
	assignedMachineId: string | null
): PlacementReleaseReason {
	const terminalReason = TERMINAL_RELEASE_REASONS.get(state);
	if (terminalReason) return terminalReason;
	if (state === SandboxState.ERROR && assignedMachineId === null) {
		return PLACEMENT_RELEASE_REASON.CREATE_FAILED;
	}
	if (!assignedMachineId) return PLACEMENT_RELEASE_REASON.UNASSIGNED;
	return releasedMachineId === assignedMachineId
		? PLACEMENT_RELEASE_REASON.RESIZED
		: PLACEMENT_RELEASE_REASON.REASSIGNED;
}

export function leaseEndReason(
	releaseReason: PlacementReleaseReason
): LeaseEndReason {
	return LEASE_END_REASONS[releaseReason];
}
