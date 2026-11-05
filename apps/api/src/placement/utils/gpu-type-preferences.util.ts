/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BadRequestException } from '@nestjs/common';
import { GpuType } from '../../machine/enums/gpu-type.enum';

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
			'No GPU types are allowed for this organization.'
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
			`Requested GPU type(s) ${gpuTypePreferences.join(', ')} not permitted for this organization. Allowed: ${allowedGpuTypes.join(', ')}.`
		);
	}
	return permitted;
}
