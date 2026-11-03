/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	MILLISECONDS_PER_HOUR,
	SECONDS_PER_MINUTE,
} from '../../../common/constants/time.constants';

export const BACKUP_STALE_TIMEOUT_MS = 2 * MILLISECONDS_PER_HOUR;
export const BACKUP_STALE_ERROR_MESSAGE = 'Backup timed out after 2 hours';

export const BACKUP_RETRY_ERROR_SUBSTRINGS: readonly string[] = [
	'connect ECONNREFUSED',
	'received unexpected HTTP status',
	'read: connection reset by peer',
	BACKUP_STALE_ERROR_MESSAGE,
];

export const BACKUP_MAX_WORKER_ERRORS = 10;
export const BACKUP_WORKER_ERROR_WINDOW_SECONDS = 5 * SECONDS_PER_MINUTE;

export const BACKUP_WORKER_LOCK_TTL_SECONDS = 10;
export const BACKUP_MAINTENANCE_LOCK_TTL_SECONDS = 5 * SECONDS_PER_MINUTE;
export const SANDBOX_BACKUP_LOCK_TTL_SECONDS = 60;
export const SANDBOX_STOP_BACKUP_LOCK_TTL_SECONDS = 30;
export const MACHINE_BACKUP_LOCK_TTL_SECONDS = 10;

export const BACKUP_PROGRESS_CURSOR_KEY = 'check-backup-progress-cursor';
export const BACKUP_RETRY_CURSOR_KEY = 'retry-errored-backups-cursor';

export const BackupJobName = {
	CHECK_PENDING: 'check-backup-states',
	CHECK_IN_PROGRESS: 'check-backup-states-in-progress',
	CHECK_ERRORED_DRAINING: 'check-backup-states-errored-draining',
	SYNC_STOP_STATE: 'sync-stop-state-create-backups',
	CHECK_STALE: 'check-stale-in-progress-backups',
	RETRY_ERRORED: 'retry-errored-backups',
} as const;

export function sandboxBackupLockKey(sandboxId: string): string {
	return `sandbox-backup-${sandboxId}`;
}

export function machineBackupLockKey(machineId: string): string {
	return `machine-${machineId}-backup-lock`;
}

export const BACKUP_POLICY = {
	retryIntervalHours: 6,
	vcpusPerConcurrentBackup: 4,
	maximumConcurrentBackupsPerMachine: 8,
} as const;

export function concurrentBackupLimit(machineCpu: number): number {
	return Math.min(
		BACKUP_POLICY.maximumConcurrentBackupsPerMachine,
		Math.max(1, Math.floor(machineCpu / BACKUP_POLICY.vcpusPerConcurrentBackup))
	);
}
