/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Volume } from '../entities/volume.entity';
import { VolumeState } from '../enums/volume-state.enum';

export function markVolumeDeleted(volume: Volume): void {
	volume.state = VolumeState.DELETED;
	volume.errorReason = null;
	volume.activeAttachmentId = null;
	volume.activeMachineId = null;
	volume.fencingToken = null;
}
