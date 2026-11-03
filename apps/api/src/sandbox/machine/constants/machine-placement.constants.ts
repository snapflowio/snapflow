/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { PlacementLocality } from '../../instance/enums/placement-locality.enum';
import { SandboxState } from '../../instance/enums/sandbox-state.enum';

export const SANDBOX_STATES_CONVERGING: readonly SandboxState[] = [
	SandboxState.CREATING,
	SandboxState.RESTORING,
	SandboxState.STARTING,
	SandboxState.RESUMING,
	SandboxState.FORKING,
	SandboxState.BUILDING_SNAPSHOT,
	SandboxState.UNKNOWN,
];

export const SLOW_START_INITIAL_WINDOW = 1;

export const PLACEMENT_LOCALITY_ORDER: readonly PlacementLocality[] = [
	PlacementLocality.PREPARED,
	PlacementLocality.PRESENT,
	PlacementLocality.REMOTE,
];

export const PLACEMENT_FAILURE_TIMING = 'failed';

export type PlacementTimingKind =
	| PlacementLocality
	| typeof PLACEMENT_FAILURE_TIMING;

export const PLACEMENT_TIMING_KINDS: readonly PlacementTimingKind[] = [
	...PLACEMENT_LOCALITY_ORDER,
	PLACEMENT_FAILURE_TIMING,
];
