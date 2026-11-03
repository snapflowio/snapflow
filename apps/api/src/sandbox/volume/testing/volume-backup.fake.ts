/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { VOLUME_BACKUP } from '../constants/volume-backup.constants';
import { VolumeBackup } from '../entities/volume-backup.entity';
import { VolumeBackupState } from '../enums/volume-backup-state.enum';

const UUID_NODE_DIGITS = 12;

export const FAKE_ORGANIZATION_ID = '7f9c2a4e-5b1d-4c3a-9e8f-1a2b3c4d5e6f';
export const FAKE_VOLUME_ID = '3c000000-0000-4000-8000-000000000003';
export const FAKE_VOLUME_SIZE_BYTES = String(VOLUME_BACKUP.BYTES_PER_GIB);

export function fakeArtifactId(generation: number): string {
	return `4d000000-0000-4000-8000-${String(generation).padStart(UUID_NODE_DIGITS, '0')}`;
}

export function fakeVolumeBackup(
	generation: number,
	overrides: Partial<VolumeBackup> = {}
): VolumeBackup {
	const artifactId = fakeArtifactId(generation);
	return Object.assign(new VolumeBackup(), {
		artifactId,
		volumeId: FAKE_VOLUME_ID,
		organizationId: FAKE_ORGANIZATION_ID,
		backupGeneration: generation,
		baseArtifactId: null,
		chainDepth: VOLUME_BACKUP.FULL_CHAIN_DEPTH,
		state: VolumeBackupState.COMPLETED,
		referencedArtifactIds: [artifactId],
		expectedVolumeSizeBytes: FAKE_VOLUME_SIZE_BYTES,
		dataKeyCiphertext: `ciphertext-${generation}`,
		prunedAt: null,
		...overrides,
	});
}
