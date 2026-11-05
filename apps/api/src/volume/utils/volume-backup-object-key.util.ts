/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { VOLUME_BACKUP_OBJECT } from '../constants/volume-backup.constants';
import type { VolumeBackup } from '../entities/volume-backup.entity';

type VolumeBackupOwner = Pick<VolumeBackup, 'organizationId' | 'volumeId'>;
type VolumeBackupLocation = VolumeBackupOwner &
	Pick<VolumeBackup, 'artifactId'>;

export interface VolumeBackupObjectKeys {
	pack: string;
	manifest: string;
}

export function volumeBackupPrefix({
	organizationId,
	volumeId,
}: VolumeBackupOwner): string {
	return `${organizationId}/${VOLUME_BACKUP_OBJECT.PREFIX}/${volumeId}/`;
}

export function volumeBackupObjectKeys(
	backup: VolumeBackupLocation
): VolumeBackupObjectKeys {
	const base = `${volumeBackupPrefix(backup)}${backup.artifactId}`;
	return {
		pack: `${base}.${VOLUME_BACKUP_OBJECT.PACK_EXTENSION}`,
		manifest: `${base}.${VOLUME_BACKUP_OBJECT.MANIFEST_EXTENSION}`,
	};
}
