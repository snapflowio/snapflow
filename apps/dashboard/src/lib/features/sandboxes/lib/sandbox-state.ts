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
	SandboxClass,
	SandboxDesiredState,
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

export const SANDBOX_ACTION_PENDING_REASON =
	'Wait for the current sandbox action to finish';
export const SANDBOX_WRITE_PERMISSION_REASON =
	'You need permission to change sandboxes in this organization';

export function resizeBlockedReason(
	sandbox: Pick<Sandbox, 'state'>
): string | null {
	return canResizeSandbox(sandbox) ? null : 'Stop the sandbox to resize it';
}

export function snapshotBlockedReason(
	sandbox: Pick<Sandbox, 'state'>
): string | null {
	return canCreateSandboxSnapshot(sandbox)
		? null
		: 'Stop the sandbox to take a snapshot';
}

export function forkBlockedReason(
	sandbox: Pick<Sandbox, 'state'>
): string | null {
	return canForkSandbox(sandbox) ? null : 'Start the sandbox to fork it';
}

export function backupBlockedReason(
	sandbox: Pick<Sandbox, 'mode' | 'state'>
): string | null {
	if (canCreateSandboxBackup(sandbox)) return null;
	return sandbox.mode === SandboxMode.Standard
		? 'Start or stop the sandbox to back it up'
		: 'Temporary sandboxes are not backed up';
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

export const MACHINE_UNAVAILABLE_NOTICE = {
	title: 'Machine unavailable',
	description:
		'The machine running this sandbox stopped responding. While it is offline the sandbox is not billed and does not count toward your limits. If the machine comes back, the sandbox resumes where it left off; if not, work since the last backup is lost. You can delete it and create a replacement at any time.',
} as const;

export function canDeleteSandbox(sandbox: Pick<Sandbox, 'state'>): boolean {
	return (
		sandbox.state !== undefined && !DELETE_BLOCKED_STATES.has(sandbox.state)
	);
}

const SANDBOX_STATE_LABELS: Record<SandboxState, string> = {
	[SandboxState.Creating]: 'Creating',
	[SandboxState.Restoring]: 'Restoring',
	[SandboxState.Destroyed]: 'Destroyed',
	[SandboxState.Destroying]: 'Destroying',
	[SandboxState.Started]: 'Running',
	[SandboxState.Stopped]: 'Stopped',
	[SandboxState.Starting]: 'Starting',
	[SandboxState.Stopping]: 'Stopping',
	[SandboxState.Error]: 'Error',
	[SandboxState.BuildFailed]: 'Build failed',
	[SandboxState.PendingBuild]: 'Pending build',
	[SandboxState.PendingPlacement]: 'Waiting for a machine',
	[SandboxState.BuildingSnapshot]: 'Building snapshot',
	[SandboxState.Unknown]: 'Unknown',
	[SandboxState.Archived]: 'Archived',
	[SandboxState.Archiving]: 'Archiving',
	[SandboxState.Resizing]: 'Resizing',
	[SandboxState.Snapshotting]: 'Snapshotting',
	[SandboxState.Forking]: 'Forking',
	[SandboxState.Pausing]: 'Pausing',
	[SandboxState.Paused]: 'Paused',
	[SandboxState.Resuming]: 'Resuming',
	[SandboxState.MachineUnavailable]: 'Machine unavailable',
};

const SANDBOX_DESIRED_STATE_LABELS: Record<SandboxDesiredState, string> = {
	[SandboxDesiredState.Destroyed]: 'Destroyed',
	[SandboxDesiredState.Started]: 'Running',
	[SandboxDesiredState.Stopped]: 'Stopped',
	[SandboxDesiredState.Resized]: 'Resized',
	[SandboxDesiredState.Archived]: 'Archived',
	[SandboxDesiredState.Paused]: 'Paused',
};

const SANDBOX_CLASS_LABELS: Record<SandboxClass, string> = {
	[SandboxClass.LinuxVm]: 'Linux microVM',
};

const TRANSITIONAL_STATES = new Set<SandboxState>([
	SandboxState.Creating,
	SandboxState.Restoring,
	SandboxState.Starting,
	SandboxState.Resuming,
	SandboxState.PendingBuild,
	SandboxState.PendingPlacement,
	SandboxState.BuildingSnapshot,
]);

export function sandboxStateLabel(state: SandboxState | undefined): string {
	return SANDBOX_STATE_LABELS[state ?? SandboxState.Unknown];
}

export function sandboxDesiredStateLabel(
	state: SandboxDesiredState | undefined
): string {
	return state === undefined
		? SANDBOX_STATE_LABELS[SandboxState.Unknown]
		: SANDBOX_DESIRED_STATE_LABELS[state];
}

export function sandboxClassLabel(
	sandboxClass: SandboxClass | undefined
): string {
	return sandboxClass === undefined
		? SANDBOX_STATE_LABELS[SandboxState.Unknown]
		: SANDBOX_CLASS_LABELS[sandboxClass];
}

export function isSandboxBecomingReady(
	sandbox: Pick<Sandbox, 'state'>
): boolean {
	return sandbox.state !== undefined && TRANSITIONAL_STATES.has(sandbox.state);
}

export function formatExpectedStart(seconds: number): string {
	return `About ${seconds} s`;
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
