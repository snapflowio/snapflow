/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BackupState } from '../../../volume/enums/backup-state.enum';
import { isApiRecoverableError } from '../../constants/errors-for-recovery.constants';
import { SandboxDesiredState } from '../../enums/sandbox-desired-state.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';
import type {
	SandboxInvariantChanges,
	SandboxStateFields,
} from '../../types/sandbox-state-fields.types';
import { awaitsAutomaticRestart } from './automatic-restart.util';

type SandboxInvariantInput = Pick<
	SandboxStateFields,
	| 'backupRegistryId'
	| 'backupSnapshot'
	| 'backupState'
	| 'desiredState'
	| 'errorReason'
	| 'pending'
	| 'machineId'
	| 'runtimeLifecycle'
	| 'state'
	| 'stopReason'
>;

const RELEASED_RUNTIME_INTENT = {
	runtimeLifecycle: null,
	runtimeSpec: null,
	runtimeSpecDigest: null,
	runtimeDirectives: null,
	runtimeRegistryId: null,
} as const satisfies SandboxInvariantChanges;

export const DESTROYED_SANDBOX_FIELDS = {
	...RELEASED_RUNTIME_INTENT,
	machineId: null,
	backupState: BackupState.NONE,
	env: {},
} as const satisfies SandboxInvariantChanges;

const RESTING_UNLESS_DESTROYED_STATES: ReadonlySet<SandboxState> = new Set([
	SandboxState.ERROR,
	SandboxState.MACHINE_UNAVAILABLE,
]);

function settlesWithoutReconciliation(sandbox: SandboxInvariantInput): boolean {
	return (
		(RESTING_UNLESS_DESTROYED_STATES.has(sandbox.state) &&
			sandbox.desiredState !== SandboxDesiredState.DESTROYED) ||
		sandbox.state === SandboxState.BUILD_FAILED ||
		sandbox.desiredState === SandboxDesiredState.ARCHIVED ||
		awaitsAutomaticRestart(sandbox)
	);
}

function pendingChange(sandbox: SandboxInvariantInput): boolean | undefined {
	if (settlesWithoutReconciliation(sandbox)) {
		return false;
	}
	const synchronized = String(sandbox.state) === String(sandbox.desiredState);
	if (!sandbox.pending && !synchronized) {
		return true;
	}
	if (sandbox.pending && synchronized) {
		return false;
	}
	return undefined;
}

function hasRecoverableBackup(sandbox: SandboxInvariantInput): boolean {
	return (
		sandbox.state === SandboxState.ERROR &&
		sandbox.backupState === BackupState.COMPLETED &&
		Boolean(sandbox.backupSnapshot) &&
		Boolean(sandbox.backupRegistryId) &&
		isApiRecoverableError(sandbox.errorReason)
	);
}

export function getSandboxInvariantChanges(
	sandbox: SandboxInvariantInput
): SandboxInvariantChanges {
	const changes: SandboxInvariantChanges = {};
	const pending = pendingChange(sandbox);
	if (pending !== undefined) {
		changes.pending = pending;
	}
	if (
		sandbox.state === SandboxState.DESTROYED ||
		sandbox.state === SandboxState.ARCHIVED
	) {
		changes.machineId = null;
	}
	if (sandbox.state === SandboxState.DESTROYED) {
		Object.assign(changes, DESTROYED_SANDBOX_FIELDS);
	}
	const machineId =
		changes.machineId === undefined ? sandbox.machineId : changes.machineId;
	if (machineId === null && sandbox.runtimeLifecycle !== null) {
		Object.assign(changes, RELEASED_RUNTIME_INTENT);
	}
	if (hasRecoverableBackup(sandbox)) {
		changes.recoverable = true;
	}
	return changes;
}
