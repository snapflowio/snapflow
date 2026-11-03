/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export enum JobErrorCode {
	UNSPECIFIED = 'unspecified',
	NONE = 'none',
	INVALID_REQUEST = 'invalid_request',
	STALE_ASSIGNMENT = 'stale_assignment',
	NOT_FOUND = 'not_found',
	IMAGE_INVALID = 'image_invalid',
	IMAGE_UNAVAILABLE = 'image_unavailable',
	SNAPSHOT_CORRUPT = 'snapshot_corrupt',
	PLATFORM_BUNDLE_FETCH_FAILED = 'platform_bundle_fetch_failed',
	PLATFORM_BUNDLE_MOUNT_FAILED = 'platform_bundle_mount_failed',
	PLATFORM_COMPONENT_NOT_FOUND = 'platform_component_not_found',
	PLATFORM_COMPONENT_NOT_EXECUTABLE = 'platform_component_not_executable',
	GUEST_AUTHENTICATION_FAILED = 'guest_authentication_failed',
	RUNTIME_UNAVAILABLE = 'runtime_unavailable',
	GUEST_NOT_READY = 'guest_not_ready',
	HOST_IO_FAILED = 'host_io_failed',
	RUNTIME_MISSING = 'runtime_missing',
	INSUFFICIENT_CAPACITY = 'insufficient_capacity',
	CANCELLED = 'cancelled',
	DEADLINE_EXCEEDED = 'deadline_exceeded',
	UNKNOWN = 'unknown',
}
