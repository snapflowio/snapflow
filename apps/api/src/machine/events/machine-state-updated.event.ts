/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { MachineDto } from '../dto/machine.dto';
import { MachineState } from '../enums/machine-state.enum';

export class MachineStateUpdatedEvent {
	constructor(
		public readonly machine: MachineDto,
		public readonly oldState: MachineState,
		public readonly newState: MachineState
	) {}
}
