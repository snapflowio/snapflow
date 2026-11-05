/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { VOLUME_BACKUP } from '../constants/volume-backup.constants';
import type { VolumeBackup } from '../entities/volume-backup.entity';
import { VolumeBackupState } from '../enums/volume-backup-state.enum';

export interface VolumeBackupChainLink {
	base: VolumeBackup | null;
	chainDepth: number;
}

const FULL_BACKUP: VolumeBackupChainLink = {
	base: null,
	chainDepth: VOLUME_BACKUP.FULL_CHAIN_DEPTH,
};

/**
 * Chains a new backup onto the latest completed one unless the chain is
 * already MAX_CHAIN_DEPTH deep or the volume size changed; a full backup
 * starts a new chain.
 */
export function selectBackupBase(
	latest: VolumeBackup | null | undefined,
	expectedVolumeSizeBytes: string
): VolumeBackupChainLink {
	if (
		!latest ||
		latest.state !== VolumeBackupState.COMPLETED ||
		latest.prunedAt ||
		latest.expectedVolumeSizeBytes !== expectedVolumeSizeBytes ||
		latest.chainDepth >= VOLUME_BACKUP.MAX_CHAIN_DEPTH
	) {
		return FULL_BACKUP;
	}
	return { base: latest, chainDepth: latest.chainDepth + 1 };
}
