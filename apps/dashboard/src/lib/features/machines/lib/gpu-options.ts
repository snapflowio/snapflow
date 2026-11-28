/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { GpuType } from '@snapflow/api-client';

const ALL_GPU_TYPES = Object.values(GpuType);

const GPU_TYPE_LABELS: Record<GpuType, string> = {
	[GpuType.H100]: 'H100',
	[GpuType.RtxPro6000]: 'RTX PRO 6000',
};

export function gpuTypeLabel(gpuType: GpuType): string {
	return GPU_TYPE_LABELS[gpuType];
}

export function getGpuOptions(allowedGpuTypes: readonly GpuType[] | undefined) {
	const gpuTypes = allowedGpuTypes ?? ALL_GPU_TYPES;
	return gpuTypes.map((gpuType) => ({
		label: gpuTypeLabel(gpuType),
		value: gpuType,
	}));
}

export function isGpuType(value: string): value is GpuType {
	return ALL_GPU_TYPES.some((gpuType) => gpuType === value);
}
