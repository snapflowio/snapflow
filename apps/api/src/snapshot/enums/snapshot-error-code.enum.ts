/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export enum SnapshotErrorCode {
	NOT_FOUND = 'snapshot_not_found',
	REQUIRED = 'snapshot_required',
	NAME_INVALID = 'snapshot_name_invalid',
	NAME_TAKEN = 'snapshot_name_taken',
	IMAGE_NAME_INVALID = 'image_name_invalid',
	SOURCE_INVALID = 'snapshot_source_invalid',
	DISK_TOO_SMALL = 'snapshot_disk_too_small',
	STATE_INVALID = 'snapshot_state_invalid',
	NOT_READY = 'snapshot_not_ready',
	BUILD_INFO_NOT_FOUND = 'snapshot_build_info_not_found',
	BUILD_LOGS_NOT_FOUND = 'snapshot_build_logs_not_found',
	GENERAL_UNDELETABLE = 'general_snapshot_undeletable',
}
