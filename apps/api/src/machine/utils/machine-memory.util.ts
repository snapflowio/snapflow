/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Machine } from '../entities/machine.entity';

export const MEBIBYTES_PER_GIBIBYTE = 1024;

export type MachineMemoryCapacity = Pick<
	Machine,
	'allocatableMemoryMiB' | 'vmMemoryOverheadMiB'
>;

export function largestGuestMemoryGiB(machine: MachineMemoryCapacity): number {
	return Math.max(
		0,
		Math.floor(
			(machine.allocatableMemoryMiB - machine.vmMemoryOverheadMiB) /
				MEBIBYTES_PER_GIBIBYTE
		)
	);
}
