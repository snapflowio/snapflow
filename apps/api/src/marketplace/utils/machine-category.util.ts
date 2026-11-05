/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { HIGH_MEMORY_GIB_PER_VCPU } from '../constants/pricing.constants';
import { MachineCategory } from '../enums/machine-category.enum';

export interface MeasuredCapacity {
	vcpu: number;
	memoryGib: number;
	gpuCount: number;
}

export function machineCategory(capacity: MeasuredCapacity): MachineCategory {
	if (!Number.isSafeInteger(capacity.vcpu) || capacity.vcpu <= 0) {
		throw new Error('A measured machine needs a positive vCPU count');
	}
	if (capacity.gpuCount > 0) return MachineCategory.GPU;
	return capacity.memoryGib >= capacity.vcpu * HIGH_MEMORY_GIB_PER_VCPU
		? MachineCategory.HIGH_MEMORY
		: MachineCategory.GENERAL;
}
