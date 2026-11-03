/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Machine } from '../../machine/entities/machine.entity';
import type { GetMachineParams } from '../../machine/types/machine-scheduling.types';

export function machineSatisfiesGpuRequest(
	machine: Pick<Machine, 'gpuCount' | 'gpuType'>,
	request: Pick<GetMachineParams, 'gpu' | 'gpuType'>
): boolean {
	if (request.gpu <= 0) return machine.gpuCount === 0;
	if (machine.gpuCount < request.gpu) return false;
	if (request.gpuType === null) return true;
	const acceptedTypes = Array.isArray(request.gpuType)
		? request.gpuType
		: [request.gpuType];
	return (
		acceptedTypes.length === 0 ||
		(machine.gpuType !== null && acceptedTypes.includes(machine.gpuType))
	);
}
