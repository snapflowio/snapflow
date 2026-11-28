/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BadRequestException } from '@nestjs/common';
import { apiError } from '../../common/utils/error/api-error.util';
import { GpuType } from '../../machine/enums/gpu-type.enum';
import { PlacementErrorCode } from '../enums/placement-error-code.enum';

export function resolveGpuTypePreferences(
	gpu: number,
	gpuTypePreferences: GpuType[] | undefined,
	allowedGpuTypes: GpuType[] | null | undefined
): GpuType[] | undefined {
	if (gpu <= 0) return undefined;

	if (allowedGpuTypes == null) {
		return gpuTypePreferences && gpuTypePreferences.length > 0
			? gpuTypePreferences
			: undefined;
	}

	if (allowedGpuTypes.length === 0) {
		throw new BadRequestException(
			apiError(
				PlacementErrorCode.GPU_TYPE_NOT_ALLOWED,
				'This organization may not use GPU sandboxes. Remove the GPU request, or contact support@snapflow.io to enable GPUs.'
			)
		);
	}

	if (!gpuTypePreferences || gpuTypePreferences.length === 0) {
		return allowedGpuTypes;
	}

	const permitted = gpuTypePreferences.filter((t) =>
		allowedGpuTypes.includes(t)
	);
	if (permitted.length === 0) {
		throw new BadRequestException(
			apiError(
				PlacementErrorCode.GPU_TYPE_NOT_ALLOWED,
				`GPU type ${gpuTypePreferences.join(', ')} is not allowed for this organization. Request one of: ${allowedGpuTypes.join(', ')}.`
			)
		);
	}
	return permitted;
}
