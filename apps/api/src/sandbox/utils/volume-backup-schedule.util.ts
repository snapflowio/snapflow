/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Sandbox } from '../entities/sandbox.entity';
import { SandboxDesiredState } from '../enums/sandbox-desired-state.enum';
import { SandboxState } from '../enums/sandbox-state.enum';
import type { Volume } from '../volume/entities/volume.entity';
import { BackupState } from '../volume/enums/backup-state.enum';
import { VolumeBackupState } from '../volume/enums/volume-backup-state.enum';
import { VolumeState } from '../volume/enums/volume-state.enum';

export type ScheduledVolume = Pick<
	Volume,
	| 'id'
	| 'state'
	| 'backupState'
	| 'lastBackupAt'
	| 'activeAttachmentId'
	| 'activeMachineId'
>;

export type ScheduledSandbox = Pick<
	Sandbox,
	| 'id'
	| 'organizationId'
	| 'machineId'
	| 'state'
	| 'desiredState'
	| 'backupState'
>;

export interface VolumeBackupScheduleInput {
	volumes: readonly ScheduledVolume[];
	sandboxes: readonly ScheduledSandbox[];
	busySandboxIds: ReadonlySet<string>;
	readyMachineIds: ReadonlySet<string>;
	cutoff: Date;
}

export interface DueVolumeBackup {
	sandboxId: string;
	organizationId: string;
	machineId: string;
	volumeIds: string[];
}

const SANDBOX_BACKUP_IN_FLIGHT: ReadonlySet<BackupState> = new Set([
	BackupState.PENDING,
	BackupState.IN_PROGRESS,
]);

export function isVolumeBackupDue(
	volume: ScheduledVolume,
	cutoff: Date
): boolean {
	return (
		volume.state === VolumeState.READY &&
		volume.backupState !== VolumeBackupState.PENDING &&
		Boolean(volume.activeAttachmentId) &&
		(!volume.lastBackupAt || volume.lastBackupAt < cutoff)
	);
}

function isRunning(
	sandbox: ScheduledSandbox,
	input: VolumeBackupScheduleInput
): sandbox is ScheduledSandbox & { machineId: string } {
	return (
		sandbox.state === SandboxState.STARTED &&
		sandbox.desiredState === SandboxDesiredState.STARTED &&
		!SANDBOX_BACKUP_IN_FLIGHT.has(sandbox.backupState) &&
		!input.busySandboxIds.has(sandbox.id) &&
		sandbox.machineId !== null &&
		input.readyMachineIds.has(sandbox.machineId)
	);
}

/** Groups due volumes by the running sandbox they are attached to. */
export function selectDueVolumeBackups(
	input: VolumeBackupScheduleInput
): DueVolumeBackup[] {
	const sandboxById = new Map(
		input.sandboxes.map((sandbox) => [sandbox.id, sandbox])
	);
	const dueBySandboxId = new Map<string, DueVolumeBackup>();
	for (const volume of input.volumes) {
		if (
			!volume.activeAttachmentId ||
			!isVolumeBackupDue(volume, input.cutoff)
		) {
			continue;
		}
		const sandbox = sandboxById.get(volume.activeAttachmentId);
		if (
			!sandbox ||
			!isRunning(sandbox, input) ||
			volume.activeMachineId !== sandbox.machineId
		) {
			continue;
		}
		const due = dueBySandboxId.get(sandbox.id) ?? {
			sandboxId: sandbox.id,
			organizationId: sandbox.organizationId,
			machineId: sandbox.machineId,
			volumeIds: [],
		};
		due.volumeIds.push(volume.id);
		dueBySandboxId.set(sandbox.id, due);
	}
	return [...dueBySandboxId.values()];
}
