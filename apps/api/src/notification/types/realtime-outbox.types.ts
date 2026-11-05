/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { MachineEvents } from '../../sandbox/machine/constants/machine-events.constants';
import type { MachineDto } from '../../sandbox/machine/dto/machine.dto';
import type { MachineState } from '../../sandbox/machine/enums/machine-state.enum';
import type { VolumeEvents } from '../../sandbox/volume/constants/volume-events.constants';
import type { VolumeDto } from '../../sandbox/volume/dto/volume.dto';
import type { VolumeState } from '../../sandbox/volume/enums/volume-state.enum';

export type RealtimeOutboxPayload =
	| {
			topic: typeof MachineEvents.CREATED;
			machine: MachineDto;
	  }
	| {
			topic: typeof MachineEvents.STATE_UPDATED;
			machine: MachineDto;
			oldState: MachineState;
			newState: MachineState;
	  }
	| {
			topic: typeof MachineEvents.UNSCHEDULABLE_UPDATED;
			machine: MachineDto;
			oldUnschedulable: boolean;
			newUnschedulable: boolean;
	  }
	| {
			topic: typeof VolumeEvents.CREATED;
			volume: VolumeDto;
	  }
	| {
			topic: typeof VolumeEvents.STATE_UPDATED;
			volume: VolumeDto;
			oldState: VolumeState;
			newState: VolumeState;
	  }
	| {
			topic: typeof VolumeEvents.LAST_USED_AT_UPDATED;
			volume: VolumeDto;
	  };
