/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SECONDS_PER_MINUTE } from '../../common/constants/time.constants';

export const VOLUME_BACKUP = {
	DATA_KEY_BYTES: 32,
	BYTES_PER_GIB: 1024 * 1024 * 1024,
	FAILED_REASON: 'Volume backup job failed',
	FULL_CHAIN_DEPTH: 0,
	MAX_CHAIN_DEPTH: 32,
} as const;

export const VOLUME_BACKUP_OBJECT = {
	PREFIX: 'volume-backups',
	PACK_EXTENSION: 'pack',
	MANIFEST_EXTENSION: 'manifest',
} as const;

export const VOLUME_BACKUP_RETENTION = {
	RETAINED_COMPLETED_BACKUPS: 3,
	VOLUME_BATCH_SIZE: 50,
	LOCK_TTL_SECONDS: 5 * SECONDS_PER_MINUTE,
} as const;

export const VOLUME_BACKUP_SCHEDULE = {
	VOLUME_BATCH_SIZE: 100,
	LOCK_TTL_SECONDS: SECONDS_PER_MINUTE,
} as const;

export const VolumeBackupJobName = {
	SCHEDULE_RUNNING: 'schedule-running-volume-backups',
	PRUNE: 'prune-volume-backups',
} as const;
