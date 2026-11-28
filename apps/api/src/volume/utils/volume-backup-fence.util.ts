/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	VolumeBackupRequest,
	VolumeBackupResult,
} from '@snapflow/machine-proto';
import type { Volume } from '../entities/volume.entity';
import type { VolumeBackup } from '../entities/volume-backup.entity';

export function backupFenceKey(
	volumeId: string,
	attachmentGeneration: number,
	fencingToken: string
): string {
	return `${volumeId}:${attachmentGeneration}:${fencingToken}`;
}

export function assertActiveBackupFence(
	volume: Volume,
	sandboxId: string,
	machineId: string,
	organizationId: string
): asserts volume is Volume & { fencingToken: string } {
	if (
		volume.organizationId !== organizationId ||
		volume.activeAttachmentId !== sandboxId ||
		volume.activeMachineId !== machineId ||
		!volume.fencingToken ||
		volume.attachmentGeneration <= 0
	) {
		throw new Error(
			`Volume ${volume.id} does not have the active backup fence`
		);
	}
}

export function assertBackupMatchesRequest(
	backup: VolumeBackup,
	request: VolumeBackupRequest,
	sandboxId: string,
	machineId: string
): void {
	if (
		backup.volumeId !== request.volumeId ||
		backup.sandboxId !== sandboxId ||
		backup.machineId !== machineId ||
		backup.backupGeneration !== request.backupGeneration ||
		backup.attachmentGeneration !== request.attachmentGeneration ||
		backup.fencingToken !== request.fencingToken
	) {
		throw new Error(`Volume backup ${backup.artifactId} fence does not match`);
	}
}

export function backupFenceMatches(
	volume: Volume,
	request: VolumeBackupRequest,
	sandboxId: string,
	machineId: string
): boolean {
	return (
		volume.activeAttachmentId === sandboxId &&
		volume.activeMachineId === machineId &&
		volume.attachmentGeneration === request.attachmentGeneration &&
		volume.fencingToken === request.fencingToken
	);
}

export function assertBackupResult(
	result: VolumeBackupResult,
	request: VolumeBackupRequest
): void {
	if (
		result.volumeId !== request.volumeId ||
		result.artifactId !== request.artifactId ||
		result.backupGeneration !== request.backupGeneration ||
		result.packSizeBytes < 0n ||
		result.manifestSizeBytes <= 0n ||
		result.changedBytes < 0n ||
		new Set(result.referencedArtifactIds).size !==
			result.referencedArtifactIds.length
	) {
		throw new Error(
			`Volume backup result ${request.artifactId} failed integrity validation`
		);
	}
}
