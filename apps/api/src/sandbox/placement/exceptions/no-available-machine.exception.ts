/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BadRequestException } from '@nestjs/common';
import { locationConstraintCode } from '../../../location/utils/location-constraint.util';
import { PlacementKind } from '../../../marketplace/enums/placement-kind.enum';
import type { GetMachineParams } from '../../machine/types/machine-scheduling.types';

const NO_AVAILABLE_MACHINES_MESSAGE = 'No available machines';
const LIST_SEPARATOR = ', ';

type UnmetRequest = Partial<Pick<GetMachineParams, 'gpuType' | 'placement'>>;

function unmetRequestMessage({ gpuType, placement }: UnmetRequest): string {
	const parts = [NO_AVAILABLE_MACHINES_MESSAGE];
	if (placement?.kind === PlacementKind.FLEXIBLE) {
		if (placement.ownMachinesOnly) {
			parts.push("among the organization's own machines");
		}
		if (placement.locations.length > 0) {
			parts.push(
				`in ${placement.locations.map(locationConstraintCode).join(LIST_SEPARATOR)}`
			);
		}
	}
	if (Array.isArray(gpuType) && gpuType.length > 0) {
		parts.push(`with GPU type: ${gpuType.join(LIST_SEPARATOR)}`);
	}
	return parts.join(' ');
}

export class NoAvailableMachineError extends BadRequestException {
	constructor(request: UnmetRequest = {}) {
		super(unmetRequestMessage(request));
	}
}
