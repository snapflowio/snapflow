/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SandboxLifecycle, SandboxRuntimeState } from '@snapflow/machine-proto';
import { MISSING_RUNTIME_ERROR_REASON } from '../../constants/errors-for-recovery.constants';
import {
	CONVERGED_RUNTIME_STATE,
	CONVERGENCE_OUTCOME,
	type ConvergenceOutcome,
	PENDING_RUNTIME_STATES,
} from '../../constants/sandbox-state-machine.constants';

export function runtimeConvergenceOutcome(
	lifecycle: SandboxLifecycle | null,
	state: SandboxRuntimeState
): ConvergenceOutcome {
	if (
		lifecycle === null ||
		lifecycle === SandboxLifecycle.UNSPECIFIED ||
		PENDING_RUNTIME_STATES.has(state)
	) {
		return CONVERGENCE_OUTCOME.PENDING;
	}
	const removed =
		lifecycle === SandboxLifecycle.DESTROYED &&
		state === SandboxRuntimeState.MISSING;
	return removed || state === CONVERGED_RUNTIME_STATE[lifecycle]
		? CONVERGENCE_OUTCOME.SUCCEEDED
		: CONVERGENCE_OUTCOME.FAILED;
}

export function runtimeConvergenceErrorReason(
	lifecycle: SandboxLifecycle | null,
	state: SandboxRuntimeState,
	reportedReason: string | undefined
): string {
	if (state === SandboxRuntimeState.MISSING) {
		return MISSING_RUNTIME_ERROR_REASON;
	}
	if (reportedReason) return reportedReason;
	const convergingTo = lifecycle ?? SandboxLifecycle.UNSPECIFIED;
	return `Machine reported ${SandboxRuntimeState[state]} while converging to ${SandboxLifecycle[convergingTo]}`;
}
