/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { MachineUpdateStatusDto } from '../dto/machine-update-status.dto';
import { MachineReadinessState } from '../enums/machine-readiness-state.enum';
import { MachineUpdatePhase } from '../enums/machine-update-phase.enum';

export function completeMachineActivation(
	status: MachineUpdateStatusDto | null,
	readiness: MachineReadinessState,
	hasUnhealthyService: boolean,
	observedAt: Date
) {
	if (
		!status ||
		status.phase !== MachineUpdatePhase.ACTIVATING ||
		readiness !== MachineReadinessState.READY ||
		hasUnhealthyService
	) {
		return undefined;
	}
	return {
		unschedulable: false,
		draining: false,
		updateStatus: {
			...status,
			phase: MachineUpdatePhase.READY,
			updatedAt: observedAt.toISOString(),
		},
	} as const;
}
