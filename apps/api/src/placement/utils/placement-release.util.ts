/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { PriceEndReason } from '../../marketplace/enums/price-end-reason.enum';
import { SandboxState } from '../../sandbox/enums/sandbox-state.enum';

const PLACEMENT_RELEASE_REASON = {
	ARCHIVED: 'archived',
	DESTROYED: 'destroyed',
	REASSIGNED: 'reassigned',
	RESIZED: 'resized',
	UNASSIGNED: 'unassigned',
	CREATE_FAILED: 'create_failed',
	BUILD_FAILED: 'build_failed',
} as const;

type PlacementReleaseReason =
	(typeof PLACEMENT_RELEASE_REASON)[keyof typeof PLACEMENT_RELEASE_REASON];

const TERMINAL_RELEASE_REASONS: ReadonlyMap<
	SandboxState,
	PlacementReleaseReason
> = new Map([
	[SandboxState.ARCHIVED, PLACEMENT_RELEASE_REASON.ARCHIVED],
	[SandboxState.DESTROYED, PLACEMENT_RELEASE_REASON.DESTROYED],
	[SandboxState.BUILD_FAILED, PLACEMENT_RELEASE_REASON.BUILD_FAILED],
]);

const PRICE_END_REASONS: Readonly<
	Record<PlacementReleaseReason, PriceEndReason>
> = {
	[PLACEMENT_RELEASE_REASON.ARCHIVED]: PriceEndReason.ARCHIVED,
	[PLACEMENT_RELEASE_REASON.DESTROYED]: PriceEndReason.DESTROYED,
	[PLACEMENT_RELEASE_REASON.REASSIGNED]: PriceEndReason.REASSIGNED,
	[PLACEMENT_RELEASE_REASON.RESIZED]: PriceEndReason.RESIZED,
	[PLACEMENT_RELEASE_REASON.UNASSIGNED]: PriceEndReason.RELEASED,
	[PLACEMENT_RELEASE_REASON.CREATE_FAILED]: PriceEndReason.RELEASED,
	[PLACEMENT_RELEASE_REASON.BUILD_FAILED]: PriceEndReason.RELEASED,
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

export function priceEndReason(
	releaseReason: PlacementReleaseReason
): PriceEndReason {
	return PRICE_END_REASONS[releaseReason];
}
