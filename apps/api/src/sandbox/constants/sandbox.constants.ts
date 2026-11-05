/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const DEFAULT_SANDBOX_OS_USER = 'snapflow';

export const DEFAULT_SANDBOX_CPU = 2;
export const DEFAULT_SANDBOX_GPU = 0;
export const DEFAULT_SANDBOX_MEMORY_GIB = 4;
export const DEFAULT_SANDBOX_DISK_GIB = 10;
export const DEFAULT_SANDBOX_STOP_INTERVAL_MINUTES = 15;
export const RETENTION_ARCHIVE_INTERVAL_MINUTES = 0;
export const DEFAULT_SANDBOX_DELETE_INTERVAL_MINUTES = -1;
export const EXAMPLE_SANDBOX_ARCHIVE_INTERVAL_MINUTES = 7 * 24 * 60;
export const SOFT_DELETED_SANDBOX_NAME_PREFIX = 'DESTROYED_';

export const DEFAULT_SNAPSHOT_IMAGE_NAME = '';
export const DEFAULT_SNAPSHOT_CPU = 1;
export const DEFAULT_SNAPSHOT_GPU = 0;
export const DEFAULT_SNAPSHOT_MEMORY_GIB = 1;
export const DEFAULT_SNAPSHOT_DISK_GIB = 3;

export const SANDBOX_WORKER_LIMITS = {
	snapshotBatchSize: 100,
	snapshotScaleDownBatchSize: 50,
	snapshotPropagationBatchSize: 150,
	lifecycleBatchSize: 100,
	readyMachineBatchSize: 100,
	machineHealthBatchSize: 100,
	drainingMachineBatchSize: 10,
	drainingSandboxBatchSize: 100,
	stateSyncPerMachineBatchSize: 50,
	unassignedStateSyncBatchSize: 250,
	archivedCompletionBatchSize: 200,
	backupPendingBatchSize: 250,
	backupInProgressBatchSize: 200,
	backupRetryBatchSize: 100,
	erroredDrainingBackupBatchSize: 100,
	stopStateBackupBatchSize: 100,
	volumeDeletionBatchSize: 100,
	machineDecommissionBatchSize: 100,
	linkedFollowerBatchSize: 100,
} as const;

export const PAUSE_WITH_MANAGED_SECRETS_UNSUPPORTED =
	'Sandboxes with managed secrets cannot be paused; stop the sandbox instead';
