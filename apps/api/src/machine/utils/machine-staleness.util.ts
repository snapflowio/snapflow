/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { FilterQuery } from '@mikro-orm/core';
import { JOB_MACHINE_API_VERSION } from '../constants/machine.constants';
import type { Machine } from '../entities/machine.entity';
import { MachineState } from '../enums/machine-state.enum';

const HEARTBEATING_MACHINE_STATES: readonly MachineState[] = [
	MachineState.READY,
	MachineState.DRAINING,
];

export function staleMachineFilter(staleBefore: Date) {
	return {
		apiVersion: JOB_MACHINE_API_VERSION,
		state: { $in: [...HEARTBEATING_MACHINE_STATES] },
		lastChecked: { $lt: staleBefore },
	} satisfies FilterQuery<Machine>;
}
