/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { VOLUME_BACKUP_RETENTION } from '../constants/volume-backup.constants';
import type { Volume } from '../entities/volume.entity';
import type { VolumeBackup } from '../entities/volume-backup.entity';
import { VolumeBackupState } from '../enums/volume-backup-state.enum';

export interface VolumeBackupRetentionPlan {
	/** Backups no longer restorable whose pack is still referenced: drop the manifest only. */
	pruneManifests: VolumeBackup[];
	/** Backups nothing retained references: drop pack, manifest and row. */
	deleteBackups: VolumeBackup[];
}

function retainedArtifactIds(
	volume: Pick<Volume, 'backupArtifactId'>,
	backups: readonly VolumeBackup[]
): Set<string> {
	const newestCompleted = backups
		.filter(
			(backup) =>
				backup.state === VolumeBackupState.COMPLETED && !backup.prunedAt
		)
		.sort((left, right) => right.backupGeneration - left.backupGeneration)
		.slice(0, VOLUME_BACKUP_RETENTION.RETAINED_COMPLETED_BACKUPS)
		.map((backup) => backup.artifactId);
	const inFlightBases = backups.flatMap((backup) =>
		backup.state === VolumeBackupState.PENDING && backup.baseArtifactId
			? [backup.baseArtifactId]
			: []
	);
	return new Set([
		...newestCompleted,
		...inFlightBases,
		...(volume.backupArtifactId ? [volume.backupArtifactId] : []),
	]);
}

export function planVolumeBackupRetention(
	volume: Pick<Volume, 'backupArtifactId'>,
	backups: readonly VolumeBackup[]
): VolumeBackupRetentionPlan {
	const retained = retainedArtifactIds(volume, backups);
	const referencedPacks = new Set(
		backups
			.filter((backup) => retained.has(backup.artifactId))
			.flatMap((backup) => backup.referencedArtifactIds)
	);
	const plan: VolumeBackupRetentionPlan = {
		pruneManifests: [],
		deleteBackups: [],
	};
	for (const backup of backups) {
		if (
			backup.state === VolumeBackupState.PENDING ||
			retained.has(backup.artifactId)
		) {
			continue;
		}
		if (
			backup.state === VolumeBackupState.COMPLETED &&
			referencedPacks.has(backup.artifactId)
		) {
			if (!backup.prunedAt) plan.pruneManifests.push(backup);
			continue;
		}
		plan.deleteBackups.push(backup);
	}
	return plan;
}
