/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	BackupState,
	type Sandbox,
	SandboxMode,
	SandboxState,
} from '@snapflow/api-client';
import type { SandboxLifecycleAction } from '#lib/api/sandboxes/sandboxes.ts';

type SandboxLifecycleView = Pick<Sandbox, 'recoverable' | 'state'>;

const DELETE_BLOCKED_STATES = new Set<SandboxState>([
	SandboxState.Archiving,
	SandboxState.BuildingSnapshot,
	SandboxState.Creating,
	SandboxState.Destroying,
	SandboxState.Forking,
	SandboxState.Pausing,
	SandboxState.Resizing,
	SandboxState.Restoring,
	SandboxState.Resuming,
	SandboxState.Snapshotting,
	SandboxState.Starting,
	SandboxState.Stopping,
]);

export function isSandboxInteractive(sandbox: Pick<Sandbox, 'state'>): boolean {
	return sandbox.state === SandboxState.Started;
}

export function canResizeSandbox(sandbox: Pick<Sandbox, 'state'>): boolean {
	return sandbox.state === SandboxState.Stopped;
}

export function canUpdateSandboxNetworkPolicy(
	sandbox: Pick<Sandbox, 'state'>
): boolean {
	return sandbox.state === SandboxState.Started;
}

export function canCreateSandboxSnapshot(
	sandbox: Pick<Sandbox, 'state'>
): boolean {
	return sandbox.state === SandboxState.Stopped;
}

export function canForkSandbox(sandbox: Pick<Sandbox, 'state'>): boolean {
	return sandbox.state === SandboxState.Started;
}

export function canCreateSandboxBackup(
	sandbox: Pick<Sandbox, 'mode' | 'state'>
): boolean {
	return (
		sandbox.mode === SandboxMode.Standard &&
		(sandbox.state === SandboxState.Started ||
			sandbox.state === SandboxState.Stopped)
	);
}

export function canRunSandboxLifecycleAction(
	sandbox: SandboxLifecycleView,
	action: SandboxLifecycleAction
): boolean {
	switch (action) {
		case 'archive':
			return sandbox.state === SandboxState.Stopped;
		case 'pause':
			return sandbox.state === SandboxState.Started;
		case 'recover':
			return (
				sandbox.state === SandboxState.Error && sandbox.recoverable === true
			);
		case 'start':
			return (
				sandbox.state === SandboxState.Archived ||
				sandbox.state === SandboxState.Paused ||
				sandbox.state === SandboxState.Stopped
			);
		case 'stop':
			return (
				sandbox.state === SandboxState.Paused ||
				sandbox.state === SandboxState.Started
			);
	}
}

export function canDeleteSandbox(sandbox: Pick<Sandbox, 'state'>): boolean {
	return (
		sandbox.state !== undefined && !DELETE_BLOCKED_STATES.has(sandbox.state)
	);
}

const BACKUP_STATE_LABELS: Record<BackupState, string> = {
	[BackupState.None]: 'None',
	[BackupState.Pending]: 'Pending',
	[BackupState.InProgress]: 'In progress',
	[BackupState.Completed]: 'Completed',
	[BackupState.Error]: 'Error',
};

export function backupStateLabel(state: BackupState | undefined): string {
	return BACKUP_STATE_LABELS[state ?? BackupState.None];
}
