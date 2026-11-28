/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export enum PlacementErrorCode {
	GPU_TYPE_NOT_ALLOWED = 'gpu_type_not_allowed',
	MOVE_REQUIRES_STOPPED_SANDBOX = 'sandbox_move_requires_stopped',
	MOVE_REQUIRES_BACKUP = 'sandbox_move_requires_backup',
	WHOLE_MACHINE_REQUIRES_PINNED_PLACEMENT = 'whole_machine_requires_pinned_placement',
	WHOLE_MACHINE_NOT_RENTABLE = 'whole_machine_not_rentable',
	MACHINE_NOT_QUALIFIED = 'placement_machine_not_qualified',
}
