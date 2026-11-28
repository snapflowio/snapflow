/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Machine } from '@snapflow/api-client';

const MEBIBYTES_PER_GIBIBYTE = 1024;
const GIBIBYTE_FRACTION_DIGITS = 1;

export const MACHINE_SERVICE_STATE = {
	awaitingReport: 'awaiting report',
	healthy: 'healthy',
	unhealthy: 'unhealthy',
} as const;

export function mebibytesToGibibytes(mebibytes: number): number {
	return Number(
		(mebibytes / MEBIBYTES_PER_GIBIBYTE).toFixed(GIBIBYTE_FRACTION_DIGITS)
	);
}

export function machineLargestGuestMemoryGiB(
	machine: Pick<Machine, 'allocatableMemoryMiB' | 'vmMemoryOverheadMiB'>
): number {
	return Math.max(
		0,
		Math.floor(
			(machine.allocatableMemoryMiB - machine.vmMemoryOverheadMiB) /
				MEBIBYTES_PER_GIBIBYTE
		)
	);
}

export function machineServiceState(
	machine: Pick<Machine, 'serviceHealth'>
): string {
	if (!machine.serviceHealth || machine.serviceHealth.length === 0) {
		return MACHINE_SERVICE_STATE.awaitingReport;
	}
	return machine.serviceHealth.every((service) => service.healthy)
		? MACHINE_SERVICE_STATE.healthy
		: MACHINE_SERVICE_STATE.unhealthy;
}

export function machineSchedulingLabel(machine: Machine): string {
	return machine.unschedulable ? 'Paused' : 'Available';
}

export function machineSchedulingActionLabel(machine: Machine): string {
	return machine.unschedulable ? 'Resume scheduling' : 'Pause scheduling';
}

export const MACHINE_DELETE_REQUIRES_PAUSE =
	'Pause scheduling on a machine before deleting it';

export function machineDeletable(machine: Machine): boolean {
	return machine.unschedulable;
}

export function machineDrainingMessage(draining: boolean): string {
	return draining
		? 'Machine decommissioning started'
		: 'Machine decommissioning canceled';
}

export function machineDrainingActionLabel(machine: Machine): string {
	return machine.draining ? 'Cancel decommissioning' : 'Start decommissioning';
}

export function machineWithdrawalMessage(withdrawn: boolean): string {
	return withdrawn ? 'Decommissioning started' : 'Machine returned to service';
}

export function machineWithdrawalActionLabel(machine: Machine): string {
	return machine.draining ? 'Return to service' : 'Decommission';
}

export interface MachineAllocation {
	allocated: number;
	total: number;
	label: string;
}

export function machineCpuAllocation(
	machine: Pick<Machine, 'cpu' | 'currentAllocatedCpu'>
): MachineAllocation {
	const allocated = machine.currentAllocatedCpu ?? 0;
	return {
		allocated,
		total: machine.cpu,
		label: `${allocated} / ${machine.cpu} vCPU`,
	};
}

export function machineMemoryAllocation(
	machine: Pick<Machine, 'allocatableMemoryMiB' | 'currentAllocatedMemoryMiB'>
): MachineAllocation {
	const allocated = mebibytesToGibibytes(
		machine.currentAllocatedMemoryMiB ?? 0
	);
	const total = mebibytesToGibibytes(machine.allocatableMemoryMiB);
	return { allocated, total, label: `${allocated} / ${total} GiB` };
}

export function machineDiskAllocation(
	machine: Pick<Machine, 'disk' | 'currentAllocatedDiskGiB'>
): MachineAllocation {
	const allocated = machine.currentAllocatedDiskGiB ?? 0;
	return {
		allocated,
		total: machine.disk,
		label: `${allocated} / ${machine.disk} GiB`,
	};
}
