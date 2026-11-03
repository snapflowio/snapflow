/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export enum SandboxState {
	CREATING = 'creating',
	RESTORING = 'restoring',
	DESTROYED = 'destroyed',
	DESTROYING = 'destroying',
	STARTED = 'started',
	STOPPED = 'stopped',
	STARTING = 'starting',
	STOPPING = 'stopping',
	ERROR = 'error',
	BUILD_FAILED = 'build_failed',
	PENDING_BUILD = 'pending_build',
	BUILDING_SNAPSHOT = 'building_snapshot',
	UNKNOWN = 'unknown',
	ARCHIVED = 'archived',
	ARCHIVING = 'archiving',
	RESIZING = 'resizing',
	SNAPSHOTTING = 'snapshotting',
	FORKING = 'forking',
	PAUSING = 'pausing',
	PAUSED = 'paused',
	RESUMING = 'resuming',
}
