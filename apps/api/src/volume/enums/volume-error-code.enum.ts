/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export enum VolumeErrorCode {
	NOT_FOUND = 'volume_not_found',
	NAME_TAKEN = 'volume_name_taken',
	REFERENCE_AMBIGUOUS = 'volume_reference_ambiguous',
	NOT_READY = 'volume_not_ready',
	IN_USE = 'volume_in_use',
	PINNED_TO_MACHINE = 'volume_pinned_to_machine',
	SHRINK_NOT_SUPPORTED = 'volume_shrink_not_supported',
	BACKUP_MISSING = 'volume_backup_missing',
}
