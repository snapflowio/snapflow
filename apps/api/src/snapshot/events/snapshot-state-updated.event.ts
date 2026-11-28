/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Snapshot } from '../entities/snapshot.entity';
import type { SnapshotState } from '../enums/snapshot-state.enum';
import { SnapshotEvent } from './snapshot.event';

export class SnapshotStateUpdatedEvent extends SnapshotEvent {
	constructor(
		snapshot: Snapshot,
		readonly oldState: SnapshotState,
		readonly newState: SnapshotState
	) {
		super(snapshot);
	}
}
