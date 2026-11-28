/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export enum JobType {
	CREATE_BACKUP = 'create_backup',
	BACKUP_VOLUMES = 'backup_volumes',
	BUILD_SNAPSHOT = 'build_snapshot',
	PUBLISH_SNAPSHOT = 'publish_snapshot',
	INSPECT_SNAPSHOT_IN_REGISTRY = 'inspect_snapshot_in_registry',
	SNAPSHOT_SANDBOX = 'snapshot_sandbox',
	DELETE_VOLUME = 'delete_volume',
	RESIZE_VOLUME = 'resize_volume',
	RESTORE_VOLUME = 'restore_volume',
	QUALIFY_MACHINE = 'qualify_machine',
	BENCHMARK_MACHINE = 'benchmark_machine',
}

export const BACKUP_JOB_TYPES: readonly JobType[] = [
	JobType.CREATE_BACKUP,
	JobType.BACKUP_VOLUMES,
];
